<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { state, saveDiary, deleteDiary, backFromEditor, toggleTag, openTagModal, saveDraft, loadDraft } from '../store'
import { todayStr, fmtDate, countWords, normalizeContent } from '../utils/helpers'
import Icon from '../components/Icon.vue'
import TiptapEditor from '../components/TiptapEditor.vue'

const isNew = computed(() => state.editingId == null)
const currentDiary = computed(() => isNew.value ? null : state.diaries.find((x) => x.id === state.editingId))

const title = ref('')
const content = ref(null)
const titleInputEl = ref(null)

const autosaveState = ref('')

function initEditor() {
  const draft = isNew.value && state.settings.autosave ? loadDraft() : null
  if (state.hasTitle) {
    title.value = isNew.value
      ? (draft ? (draft.title || '') : '')
      : (currentDiary.value ? (currentDiary.value.title || '') : '')
  } else {
    title.value = ''
  }
  content.value = normalizeContent(isNew.value
    ? (draft ? draft.content : null)
    : (currentDiary.value ? currentDiary.value.content : null))
  autosaveState.value = isNew.value
    ? (state.settings.autosave ? '自动保存草稿中…' : '新建日记')
    : ('编辑 · ' + (currentDiary.value ? currentDiary.value.date : ''))
}
initEditor()

const wordCount = computed(() => countWords(content.value))
const dateLabel = computed(() => fmtDate(isNew.value ? (state.newDiaryDate || todayStr()) : currentDiary.value.date))

let autosaveTimer = null
function scheduleAutosave() {
  if (!isNew.value || !state.settings.autosave) return
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    saveDraft(title.value, content.value)
    autosaveState.value = '已自动保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }, 600)
}

watch([title, content], scheduleAutosave)
watch(() => [...state.activeTags], scheduleAutosave)

function onSave() {
  const result = saveDiary(state.hasTitle ? title.value.trim() : '', content.value)
  if (result === 'title' && titleInputEl.value) titleInputEl.value.focus()
}

function onToggleTitle() {
  state.hasTitle = !state.hasTitle
  if (!state.hasTitle) title.value = ''
  if (state.editingId == null) saveDraft(title.value, content.value)
  if (state.hasTitle && titleInputEl.value) titleInputEl.value.focus()
}

onMounted(() => {
  if (isNew.value && state.hasTitle && titleInputEl.value) titleInputEl.value.focus()
})
</script>

<template>
  <section class="view">
    <div class="editor-head">
      <button class="btn btn-icon btn-ghost" title="返回" @click="backFromEditor"><Icon name="back" /></button>
      <div class="spacer"></div>
      <button v-if="!isNew" class="btn btn-danger-ghost" @click="deleteDiary(currentDiary.id)"><Icon name="trash" /> 删除</button>
      <button class="btn btn-primary" @click="onSave">保存日记</button>
    </div>

    <div class="card editor-card">
      <input v-if="state.hasTitle" ref="titleInputEl" v-model="title" class="title-input" type="text" placeholder="给今天起个标题…" maxlength="60">


      <div class="editor-meta">
        <span class="meta-chip"><Icon name="calendar" /> {{ dateLabel }}</span>
        <button type="button" class="title-toggle" :class="{ on: state.hasTitle }" role="switch" :aria-checked="state.hasTitle" @click="onToggleTitle">
          <span class="tt-track"><span class="tt-thumb"></span></span>
          <span class="tt-label">标题</span>
        </button>
      </div>

      <div class="tag-picker">
        <span class="tag-picker-label"><Icon name="tag" /> 标签<span v-if="!state.hasTitle" class="tag-req">必选</span></span>
        <div class="tag-sel">
          <span v-for="t in state.activeTags" :key="t" class="tag-sel-chip">{{ t }}
            <button type="button" class="x" title="移除" :aria-label="`移除 ${t}`" @click="toggleTag(t)"><Icon name="x" /></button>
          </span>
          <span v-if="!state.activeTags.length" class="tag-sel-empty">还未添加标签</span>
          <button type="button" class="tag-add-btn" @click="openTagModal"><Icon name="plus" /> 添加标签</button>
        </div>
      </div>

      <TiptapEditor v-model="content" placeholder="日记内容编写…" :autofocus="isNew && !state.hasTitle" />

      <div class="editor-foot">
        <span class="word-count">{{ wordCount }} 字</span>
        <span class="word-count">{{ autosaveState }}</span>
      </div>
    </div>
  </section>
</template>