import { invoke } from '@tauri-apps/api/core'

export function loadMeta() {
  return invoke('load_meta')
}

export function getBody(id) {
  return invoke('get_body', { id })
}

export function saveDiary(diary) {
  return invoke('save_diary', { diary })
}

export function deleteDiary(id) {
  return invoke('delete_diary', { id })
}

export function searchDiaries(query) {
  return invoke('search_diaries', { query })
}

export function loadConfig() {
  return invoke('load_config')
}

export function saveConfig(config) {
  return invoke('save_config', { config })
}

export function getDataDir() {
  return invoke('get_data_dir')
}

export function setDataDir(path) {
  return invoke('set_data_dir', { path })
}
