use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiaryMeta {
    pub id: u64,
    pub title: String,
    pub date: String,
    pub tags: Vec<String>,
    pub word_count: usize,
    pub excerpt: String,
    #[serde(default)]
    pub dir_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageInput {
    pub name: String,
    pub data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDiaryInput {
    pub id: u64,
    pub title: String,
    pub date: String,
    pub tags: Vec<String>,
    pub content: serde_json::Value,
    pub text: String,
    pub word_count: usize,
    pub excerpt: String,
    #[serde(default)]
    pub images: Vec<ImageInput>,
    #[serde(default)]
    pub keep_images: Vec<String>,
}

pub struct Db {
    dir: Mutex<PathBuf>,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn data_config_path() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_default()
        .join("shiguang.config.json")
}

/// 数据目录（data 目录，不含 shiguang 子目录），默认在运行目录下
fn data_root() -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    if let Ok(s) = fs::read_to_string(data_config_path()) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            if let Some(p) = v.get("dataDir").and_then(|x| x.as_str()) {
                let p = p.trim();
                if !p.is_empty() {
                    return Ok(PathBuf::from(p));
                }
            }
        }
    }
    Ok(cwd.join("data"))
}

/// 应用数据目录（data/shiguang）
fn resolve_data_dir() -> Result<PathBuf, String> {
    Ok(data_root()?.join("shiguang"))
}

impl Db {
    pub fn open(_app: &AppHandle) -> Result<Self, String> {
        // 数据目录默认在运行目录下，可在设置里自定义
        let dir = resolve_data_dir()?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(dir.join("diaries")).map_err(|e| e.to_string())?;
        Ok(Self {
            dir: Mutex::new(dir),
        })
    }

    fn root(&self) -> PathBuf {
        self.dir.lock().unwrap().clone()
    }

    fn meta_path(&self) -> PathBuf {
        self.root().join("meta.json")
    }
    fn search_path(&self) -> PathBuf {
        self.root().join("search.json")
    }
    fn config_path(&self) -> PathBuf {
        self.root().join("config.json")
    }
    fn date_dir(&self, date: &str) -> PathBuf {
        let mut parts = date.split('-');
        let year = parts.next().unwrap_or("0000");
        let month = parts.next().unwrap_or("00");
        self.root().join("diaries").join(year).join(month).join(date)
    }

    fn diary_dir(&self, date: &str, dir_name: &str) -> PathBuf {
        self.date_dir(date).join(dir_name)
    }

    fn diary_json_path(&self, date: &str, dir_name: &str) -> PathBuf {
        self.diary_dir(date, dir_name).join(format!("{}.json", dir_name))
    }

    fn read_meta(&self) -> Vec<DiaryMeta> {
        let s = fs::read_to_string(self.meta_path()).unwrap_or_default();
        serde_json::from_str(&s).unwrap_or_default()
    }

    fn write_meta(&self, list: &[DiaryMeta]) -> Result<(), String> {
        let json = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
        fs::write(self.meta_path(), json).map_err(|e| e.to_string())
    }

    fn read_search(&self) -> HashMap<String, String> {
        let s = fs::read_to_string(self.search_path()).unwrap_or_default();
        serde_json::from_str(&s).unwrap_or_default()
    }

    fn write_search(&self, map: &HashMap<String, String>) -> Result<(), String> {
        let json = serde_json::to_string(map).map_err(|e| e.to_string())?;
        fs::write(self.search_path(), json).map_err(|e| e.to_string())
    }
}

/// 递归把 content 里 image 节点的 src（临时名）替换成磁盘绝对路径
fn replace_image_src(
    node: &mut serde_json::Value,
    replacements: &HashMap<String, String>,
) {
    if let Some(obj) = node.as_object_mut() {
        if let Some(attrs) = obj.get_mut("attrs").and_then(|a| a.as_object_mut()) {
            if let Some(src) = attrs.get("src").and_then(|s| s.as_str()) {
                if let Some(new_src) = replacements.get(src) {
                    attrs.insert(
                        "src".to_string(),
                        serde_json::Value::String(new_src.clone()),
                    );
                }
            }
        }
        if let Some(children) = obj.get_mut("content").and_then(|c| c.as_array_mut()) {
            for child in children {
                replace_image_src(child, replacements);
            }
        }
    }
}

#[tauri::command]
pub fn load_meta(state: State<'_, Db>) -> Result<Vec<DiaryMeta>, String> {
    Ok(state.read_meta())
}

#[tauri::command]
pub fn get_body(state: State<'_, Db>, id: u64) -> Result<Option<serde_json::Value>, String> {
    let list = state.read_meta();
    let Some(m) = list.iter().find(|m| m.id == id) else {
        return Ok(None);
    };
    let p = state.diary_json_path(&m.date, &m.dir_name);
    if !p.exists() {
        return Ok(None);
    }
    let s = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&s).ok())
}

#[tauri::command]
pub fn save_diary(state: State<'_, Db>, diary: SaveDiaryInput) -> Result<(u64, String), String> {
    let mut list = state.read_meta();

    let (new_id, dir_name, old_date) = if diary.id == 0 {
        (
            list.iter().map(|m| m.id).max().unwrap_or(0) + 1,
            now_ms().to_string(),
            None,
        )
    } else {
        let existing = list.iter().find(|m| m.id == diary.id);
        let dir_name = existing
            .map(|m| m.dir_name.clone())
            .unwrap_or_else(|| now_ms().to_string());
        let old_date = existing.map(|m| m.date.clone());
        (diary.id, dir_name, old_date)
    };

    let date_dir = state.date_dir(&diary.date);
    fs::create_dir_all(&date_dir).map_err(|e| e.to_string())?;

    let diary_dir = date_dir.join(&dir_name);

    // 编辑且日期变化：把整个日记目录移动到新日期目录
    if let Some(old_date) = old_date {
        if old_date != diary.date {
            let old_diary_dir = state.date_dir(&old_date).join(&dir_name);
            if old_diary_dir.exists() && !diary_dir.exists() {
                let _ = fs::rename(&old_diary_dir, &diary_dir);
            }
        }
    }
    fs::create_dir_all(&diary_dir).map_err(|e| e.to_string())?;

    // 只在有图片时才创建 imageFiles_{时间戳} 目录
    let image_dir = diary_dir.join(format!("imageFiles_{}", dir_name));
    let mut replacements: HashMap<String, String> = HashMap::new();
    let mut kept: Vec<String> = diary.keep_images.clone();
    if !diary.images.is_empty() {
        fs::create_dir_all(&image_dir).map_err(|e| e.to_string())?;
        for img in &diary.images {
            let bytes = general_purpose::STANDARD
                .decode(&img.data)
                .map_err(|e| e.to_string())?;
            // 最终文件名 = 日记时间戳_序号
            let new_name = format!("{}_{}", dir_name, img.name);
            let path = image_dir.join(&new_name);
            fs::write(&path, &bytes).map_err(|e| e.to_string())?;
            replacements.insert(img.name.clone(), path.to_string_lossy().to_string());
            kept.push(new_name);
        }
    }

    // 没有图片时删除整个 imageFiles 目录；否则清理不再被引用的旧文件
    if kept.is_empty() {
        let _ = fs::remove_dir_all(&image_dir);
    } else if let Ok(entries) = fs::read_dir(&image_dir) {
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            if !kept.contains(&fname) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }

    // 正文里的图片 src 换成磁盘绝对路径
    let mut content = diary.content;
    replace_image_src(&mut content, &replacements);

    let body_json = serde_json::to_string(&content).map_err(|e| e.to_string())?;
    fs::write(diary_dir.join(format!("{}.json", dir_name)), body_json)
        .map_err(|e| e.to_string())?;

    let meta = DiaryMeta {
        id: new_id,
        title: diary.title.clone(),
        date: diary.date.clone(),
        tags: diary.tags.clone(),
        word_count: diary.word_count,
        excerpt: diary.excerpt.clone(),
        dir_name: dir_name.clone(),
    };
    if let Some(m) = list.iter_mut().find(|m| m.id == new_id) {
        *m = meta;
    } else {
        list.push(meta);
    }
    state.write_meta(&list)?;

    let mut search = state.read_search();
    search.insert(new_id.to_string(), diary.text);
    state.write_search(&search)?;

    Ok((new_id, dir_name))
}

#[tauri::command]
pub fn delete_diary(state: State<'_, Db>, id: u64) -> Result<(), String> {
    let mut list = state.read_meta();
    let found = list
        .iter()
        .find(|m| m.id == id)
        .map(|m| (m.date.clone(), m.dir_name.clone()));
    list.retain(|m| m.id != id);
    state.write_meta(&list)?;

    if let Some((date, dir_name)) = found {
        let _ = fs::remove_dir_all(state.diary_dir(&date, &dir_name));
    }

    let mut search = state.read_search();
    search.remove(&id.to_string());
    state.write_search(&search)?;

    Ok(())
}

#[tauri::command]
pub fn search_diaries(state: State<'_, Db>, query: String) -> Result<Vec<u64>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let list = state.read_meta();
    let search = state.read_search();
    let mut ids = Vec::new();
    for m in &list {
        if m.title.to_lowercase().contains(&q) {
            ids.push(m.id);
            continue;
        }
        if let Some(t) = search.get(&m.id.to_string()) {
            if t.to_lowercase().contains(&q) {
                ids.push(m.id);
            }
        }
    }
    Ok(ids)
}

#[tauri::command]
pub fn load_config(state: State<'_, Db>) -> Result<Option<serde_json::Value>, String> {
    let p = state.config_path();
    if !p.exists() {
        return Ok(None);
    }
    let s = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&s).ok())
}

#[tauri::command]
pub fn save_config(state: State<'_, Db>, config: serde_json::Value) -> Result<(), String> {
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(state.config_path(), json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_data_dir() -> Result<String, String> {
    Ok(data_root()?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_data_dir(state: State<'_, Db>, path: String) -> Result<String, String> {
    let p = path.trim();
    let new_root = if p.is_empty() {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join("data")
    } else {
        PathBuf::from(p)
    };
    let new_dir = new_root.join("shiguang");
    let old_dir = state.root();

    if new_dir == old_dir {
        return Ok(new_root.to_string_lossy().to_string());
    }

    // 迁移当前数据到新目录（复制，保留原数据）
    if old_dir.exists() {
        fs::create_dir_all(new_dir.parent().unwrap_or(&new_dir)).map_err(|e| e.to_string())?;
        copy_dir_all(&old_dir, &new_dir)?;
    }

    // 立即切换到新目录
    *state.dir.lock().unwrap() = new_dir;

    // 写入配置
    let config = serde_json::json!({ "dataDir": new_root.to_string_lossy().to_string() });
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(data_config_path(), json).map_err(|e| e.to_string())?;

    Ok(new_root.to_string_lossy().to_string())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
