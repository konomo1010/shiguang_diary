import { reactive, ref } from 'vue'
import { SEED_DIARIES, SEED_TAGS } from './data/seed'
import { todayStr, normalizeContent, docToText } from './utils/helpers'

const STORE_KEY = 'shiguang-diary-v1'
const DRAFT_KEY = STORE_KEY + '-draft'
const DEFAULT_SETTINGS = { theme: 'light', fontSize: 16, autosave: true, reminders: false, showListExcerpt: true }
const DEFAULT_USER = { name: '拾光用户', avatar: '' }

const state = reactive({
  diaries: SEED_DIARIES.map((d, i) => ({ id: i + 1, ...d, content: normalizeContent(d.content) })),
  tags: [...SEED_TAGS],
  settings: { ...DEFAULT_SETTINGS },
  user: { ...DEFAULT_USER },
  view: 'home',
  editingId: null,
  tagFilter: null,
  search: '',
  activeTags: [],
  hasTitle: true,
  calSelected: null,
  newDiaryDate: null,
  calPickerOpen: false,
  calPickerView: 'month',
  calPickerYear: new Date().getFullYear(),
  calPickerDecade: Math.floor(new Date().getFullYear() / 12) * 12
})

// Date cannot live inside reactive (internal slot access would break on the proxy)
const calAnchor = ref(new Date())

// ----- Modal -----
const modal = reactive({
  open: false,
  title: '',
  body: '',
  confirmText: '确定',
  danger: false,
  input: false,
  inputPlaceholder: '标签名',
  inputValue: '',
  onConfirm: null
})

// ----- Tag modal -----
const tagModal = reactive({ open: false, search: '' })

// ----- Toasts -----
const toasts = reactive([])
let toastId = 0

// ----- Config directory (persisted via IndexedDB) -----
const configDirName = ref('')
let configDirHandle = null

/* ================= Persistence ================= */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      state.diaries = (saved.diaries || state.diaries).map((d) => ({ ...d, content: normalizeContent(d.content) }))
      state.tags = saved.tags || state.tags
      Object.assign(state.settings, DEFAULT_SETTINGS, saved.settings)
      Object.assign(state.user, DEFAULT_USER, saved.user)
    }
  } catch (e) { /* ignore corrupted storage */ }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      diaries: state.diaries, tags: state.tags, settings: state.settings, user: state.user
    }))
  } catch (e) { /* storage may be unavailable */ }
}

/* ================= Draft ================= */
function saveDraft(title, content) {
  if (!state.settings.autosave || state.editingId != null) return
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: title || '',
      content: content || '',
      tags: state.activeTags,
      hasTitle: state.hasTitle
    }))
  } catch (e) { /* ignore */ }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) { return null }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch (e) { /* ignore */ }
}

/* ================= Derived helpers ================= */
function tagCount(name) {
  return state.diaries.filter((d) => (d.tags || []).includes(name)).length
}

function computeStats() {
  const total = state.diaries.length
  const words = state.diaries.reduce((s, d) => s + countWords(d.content) + countWords(d.title), 0)
  const dates = state.diaries.map((d) => d.date).sort()
  const activeDays = new Set(dates).size
  return {
    total, words, activeDays,
    earliest: dates[0] || '—',
    latest: dates[dates.length - 1] || '—'
  }
}

function userAvatarChar() {
  const avatar = (state.user.avatar || '').trim().charAt(0)
  if (avatar) return avatar
  return (state.user.name || '拾').trim().charAt(0) || '拾'
}

function countWords(s) {
  return docToText(s).replace(/\s/g, '').length
}

/* ================= Navigation ================= */
function showView(view) {
  state.view = view
  if (view === 'tags') state.tagFilter = null
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/* ================= Diary CRUD ================= */
function newDiary(dateStr) {
  state.editingId = null
  state.newDiaryDate = dateStr || null
  const draft = state.settings.autosave ? loadDraft() : null
  state.activeTags = draft && draft.tags ? [...draft.tags] : []
  state.hasTitle = draft && typeof draft.hasTitle === 'boolean' ? draft.hasTitle : true
  showView('editor')
}

function editDiary(id) {
  state.editingId = id
  const d = state.diaries.find((x) => x.id === id)
  state.activeTags = d ? [...(d.tags || [])] : []
  state.hasTitle = !!(d && d.title && d.title.trim())
  showView('editor')
}

// returns: null (saved) | 'title' (needs title focus) | 'tags' (tag modal opened)
function saveDiary(title, content) {
  if (state.hasTitle && !title) {
    toast('请先写一个标题，或关闭标题栏', 'danger')
    return 'title'
  }
  if (!state.hasTitle && !state.activeTags.length) {
    toast('关闭标题后请至少选择一个标签', 'danger')
    openTagModal()
    return 'tags'
  }

  if (state.editingId == null) {
    const id = Math.max(0, ...state.diaries.map((d) => d.id)) + 1
    state.diaries.push({ id, title, content, date: state.newDiaryDate || todayStr(), tags: [...state.activeTags] })
    toast('日记已保存', 'success')
  } else {
    const d = state.diaries.find((x) => x.id === state.editingId)
    if (d) { d.title = title; d.content = content; d.tags = [...state.activeTags] }
    toast('修改已保存', 'success')
  }
  state.newDiaryDate = null
  persist()
  clearDraft()
  showView('diary')
  return null
}

function deleteDiary(id) {
  const d = state.diaries.find((x) => x.id === id)
  if (!d) return
  openModal({
    title: '删除这篇日记？',
    body: `${d.title && d.title.trim() ? `「${d.title}」` : '这篇日记'}删除后无法恢复。`,
    confirmText: '删除',
    danger: true,
    onConfirm: () => {
      state.diaries = state.diaries.filter((x) => x.id !== id)
      persist()
      toast('日记已删除', 'success')
      showView('diary')
    }
  })
}

function backFromEditor() {
  state.editingId = null
  showView('diary')
}

/* ================= Tags ================= */
function toggleTag(tag) {
  const i = state.activeTags.indexOf(tag)
  if (i >= 0) state.activeTags.splice(i, 1)
  else state.activeTags.push(tag)
}

function openTagModal() {
  tagModal.open = true
  tagModal.search = ''
}

function closeTagModal() {
  tagModal.open = false
}

function addTagFromModal(preset) {
  openModal({
    title: '新建标签',
    body: '输入一个新标签名，用于归类日记。',
    confirmText: '添加',
    input: true,
    inputValue: preset || '',
    onConfirm: (value) => {
      const name = value.trim()
      if (!name) { toast('标签名不能为空', 'danger'); return false }
      if (state.tags.includes(name)) { toast('这个标签已存在', 'danger'); return false }
      state.tags.push(name)
      if (!state.activeTags.includes(name)) state.activeTags.push(name)
      persist()
      toast(`标签「${name}」已添加并选中`, 'success')
      tagModal.open = true
      return false
    }
  })
}

function openAddTag() {
  openModal({
    title: '添加标签',
    body: '输入一个新标签名，用于归类日记。',
    confirmText: '添加',
    input: true,
    onConfirm: (value) => {
      const name = value.trim()
      if (!name) { toast('标签名不能为空', 'danger'); return false }
      if (state.tags.includes(name)) { toast('这个标签已存在', 'danger'); return false }
      state.tags.push(name)
      persist()
      toast(`标签「${name}」已添加`, 'success')
      return true
    }
  })
}

function renameTag(oldName) {
  openModal({
    title: '重命名标签',
    body: `把标签「${oldName}」改成新名称，所有引用它的日记会一并更新。`,
    confirmText: '保存',
    input: true,
    inputValue: oldName,
    onConfirm: (value) => {
      const name = value.trim()
      if (!name) { toast('标签名不能为空', 'danger'); return false }
      if (name === oldName) return true
      if (state.tags.includes(name)) { toast('这个标签已存在', 'danger'); return false }
      const idx = state.tags.indexOf(oldName)
      if (idx > -1) state.tags[idx] = name
      state.diaries.forEach((d) => {
        if ((d.tags || []).includes(oldName)) {
          d.tags = d.tags.map((t) => (t === oldName ? name : t))
        }
      })
      if (state.activeTags.includes(oldName)) {
        state.activeTags = state.activeTags.map((t) => (t === oldName ? name : t))
      }
      persist()
      toast(`标签已重命名为「${name}」`, 'success')
      return true
    }
  })
}

function deleteTag(name) {
  openModal({
    title: '删除标签',
    body: `确定删除标签「${name}」吗？该标签会从所有日记中移除，但日记本身不会被删除。`,
    confirmText: '删除',
    danger: true,
    onConfirm: () => {
      state.tags = state.tags.filter((t) => t !== name)
      state.diaries.forEach((d) => {
        if (d.tags) d.tags = d.tags.filter((t) => t !== name)
      })
      state.activeTags = state.activeTags.filter((t) => t !== name)
      persist()
      toast(`标签「${name}」已删除`, 'success')
      return true
    }
  })
}

/* ================= Calendar ================= */
function calShift(delta) {
  state.calPickerOpen = false
  const d = new Date(calAnchor.value)
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  calAnchor.value = d
}

function calGotoToday() {
  state.calPickerOpen = false
  calAnchor.value = new Date()
  state.calSelected = todayStr()
}

function calTogglePicker() {
  const y = calAnchor.value.getFullYear()
  state.calPickerOpen = !state.calPickerOpen
  if (state.calPickerOpen) {
    state.calPickerView = 'month'
    state.calPickerYear = y
    state.calPickerDecade = Math.floor(y / 12) * 12
  }
}

function calPickerToggleView() {
  state.calPickerView = state.calPickerView === 'month' ? 'year' : 'month'
}

function calPickerDecade(delta) {
  state.calPickerDecade += delta
}

function calPickerSelectYear(year) {
  state.calPickerYear = year
  state.calPickerView = 'month'
}

function calPickerYearStep(delta) {
  state.calPickerYear += delta
  state.calPickerDecade = Math.floor(state.calPickerYear / 12) * 12
}

function calPickerSelectMonth(m) {
  const d = new Date(calAnchor.value)
  d.setDate(1)
  d.setFullYear(state.calPickerYear)
  d.setMonth(m)
  calAnchor.value = d
  state.calPickerOpen = false
}

function calSelect(dateStr) {
  state.calSelected = dateStr
}

/* ================= Search / filter ================= */
function filterByTag(tag) {
  state.tagFilter = tag
  state.search = ''
  showView('diary')
}

function clearTagFilter() {
  state.tagFilter = null
}

function clearFilters() {
  state.search = ''
  state.tagFilter = null
}

/* ================= Settings ================= */
function setTheme(t) {
  state.settings.theme = t
  applyTheme()
  persist()
}

function setFontSize(v) {
  state.settings.fontSize = Number(v)
  document.documentElement.style.fontSize = state.settings.fontSize + 'px'
  persist()
}

function setAutosave(v) {
  state.settings.autosave = v
  persist()
  toast(v ? '已开启自动保存' : '已关闭自动保存', 'success')
}

function setReminders(v) {
  state.settings.reminders = v
  persist()
  toast(v ? '已开启每日提醒' : '已关闭每日提醒', 'success')
}

function setShowListExcerpt(v) {
  state.settings.showListExcerpt = v
  persist()
  toast(v ? '已显示列表内容摘要' : '已隐藏列表内容摘要', 'success')
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme)
}

function setUserName(v) {
  state.user.name = (v || '').trim() || '拾光用户'
  persist()
  toast('用户名已更新', 'success')
}

function setUserAvatar(v) {
  state.user.avatar = (v || '').trim().charAt(0)
  persist()
}

function exportData() {
  const blob = new Blob([JSON.stringify({ diaries: state.diaries, tags: state.tags }, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `拾光日记-${todayStr()}.json`)
  toast('数据已导出', 'success')
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function clearAll() {
  openModal({
    title: '清空所有数据？',
    body: '将删除全部日记与标签，此操作不可恢复。',
    confirmText: '确认清空',
    danger: true,
    onConfirm: () => {
      state.diaries = []
      state.tags = []
      persist()
      clearDraft()
      toast('所有数据已清空', 'success')
      showView('home')
    }
  })
}

/* ================= Config directory (File System Access + IndexedDB) ================= */
const CONFIG_DIR_DB = 'shiguang-config-dir'
const CONFIG_DIR_STORE = 'dir'

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CONFIG_DIR_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(CONFIG_DIR_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function restoreConfigDir() {
  if (!window.indexedDB) return
  try {
    const db = await idbOpen()
    const get = db.transaction(CONFIG_DIR_STORE, 'readonly').objectStore(CONFIG_DIR_STORE).get('dir')
    const saved = await new Promise((res) => { get.onsuccess = () => res(get.result); get.onerror = () => res(null) })
    if (saved && saved.handle) {
      configDirHandle = saved.handle
      configDirName.value = saved.name || (configDirHandle.name || '')
    }
    db.close()
  } catch (e) { /* ignore */ }
}

async function persistConfigDir() {
  if (!window.indexedDB) return
  try {
    const db = await idbOpen()
    const tx = db.transaction(CONFIG_DIR_STORE, 'readwrite')
    tx.objectStore(CONFIG_DIR_STORE).put({ handle: configDirHandle, name: configDirName.value }, 'dir')
    db.close()
  } catch (e) { /* ignore */ }
}

async function chooseConfigDir() {
  if (!window.showDirectoryPicker) {
    toast('当前浏览器不支持选择固定文件夹，将使用默认下载位置', '')
    return
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    configDirHandle = handle
    configDirName.value = handle.name || ''
    persistConfigDir()
    toast('保存位置已设为「' + configDirName.value + '」', 'success')
  } catch (e) {
    if (e && e.name === 'AbortError') return
  }
}

async function clearConfigDir() {
  configDirHandle = null
  configDirName.value = ''
  persistConfigDir()
  toast('已恢复为默认保存位置', 'success')
}

async function saveConfig() {
  const config = {
    _comment: '拾光日记 · 配置文件（diary_config.json）',
    savedAt: new Date().toISOString(),
    settings: state.settings
  }
  const json = JSON.stringify(config, null, 2)
  const filename = 'diary_config.json'

  if (configDirHandle) {
    try {
      const fileHandle = await configDirHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(json)
      await writable.close()
      toast('配置已保存到「' + configDirName.value + '」', 'success')
      return
    } catch (e) {
      if (e && e.name === 'AbortError') return
    }
  }

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON 配置文件', accept: { 'application/json': ['.json'] } }]
      })
      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()
      toast('配置已保存到 ' + (handle.name || filename), 'success')
      return
    } catch (e) {
      if (e && e.name === 'AbortError') return
    }
  }

  downloadBlob(new Blob([json], { type: 'application/json' }), filename)
  toast('配置已保存为 ' + filename, 'success')
}

function importConfig() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = () => {
    const file = input.files && input.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const s = data.settings || data
        if (typeof s !== 'object' || s === null) throw new Error()
        Object.assign(state.settings, DEFAULT_SETTINGS, s)
        persist()
        applyTheme()
        document.documentElement.style.fontSize = state.settings.fontSize + 'px'
        toast('配置已导入', 'success')
      } catch (e) {
        toast('配置导入失败：文件格式不正确', 'danger')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

/* ================= Modal ================= */
function openModal(opts) {
  modal.open = true
  modal.title = opts.title
  modal.body = opts.body
  modal.confirmText = opts.confirmText || '确定'
  modal.danger = !!opts.danger
  modal.input = !!opts.input
  modal.inputPlaceholder = opts.inputPlaceholder || '标签名'
  modal.inputValue = opts.inputValue || ''
  modal.onConfirm = opts.onConfirm || null
}

function closeModal() {
  modal.open = false
  modal.onConfirm = null
}

function confirmModal() {
  const fn = modal.onConfirm
  if (!fn) { closeModal(); return }
  let result = true
  if (modal.input) result = fn(modal.inputValue)
  else result = fn()
  if (result !== false) closeModal()
}

/* ================= Toast ================= */
function toast(msg, type = '') {
  const id = ++toastId
  toasts.push({ id, msg, type })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, 2400)
}

/* ================= Init ================= */
function init() {
  load()
  restoreConfigDir()
  applyTheme()
  document.documentElement.style.fontSize = state.settings.fontSize + 'px'
  showView('home')
}

export {
  state,
  calAnchor,
  configDirName,
  modal,
  tagModal,
  toasts,
  // persistence
  persist, load,
  // draft
  saveDraft, loadDraft, clearDraft,
  // helpers
  tagCount, computeStats, userAvatarChar,
  // navigation
  showView,
  // diary
  newDiary, editDiary, saveDiary, deleteDiary, backFromEditor,
  // tags
  toggleTag, openTagModal, closeTagModal, addTagFromModal, openAddTag, renameTag, deleteTag,
  // calendar
  calShift, calGotoToday, calTogglePicker, calPickerToggleView, calPickerDecade,
  calPickerSelectYear, calPickerYearStep, calPickerSelectMonth, calSelect,
  // search / filter
  filterByTag, clearTagFilter, clearFilters,
  // settings
  setTheme, setFontSize, setAutosave, setReminders, setShowListExcerpt,
  applyTheme, setUserName, setUserAvatar, exportData, clearAll,
  // config
  restoreConfigDir, chooseConfigDir, clearConfigDir, saveConfig, importConfig,
  // modal
  openModal, closeModal, confirmModal,
  // toast
  toast,
  // init
  init
}