<script setup>
import { reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Image from '@tiptap/extension-image'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Slice, Fragment } from '@tiptap/pm/model'
import { dropPoint } from '@tiptap/pm/transform'
import Icon from './Icon.vue'
import { normalizeContent } from '../utils/helpers'
import { saveImage, loadImage } from '../utils/imageStore'

const props = defineProps({
  modelValue: { type: [Object, String], default: null },
  placeholder: { type: String, default: '' },
  autofocus: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

/* ================= Slash command plugin ================= */
const slashPluginKey = new PluginKey('slash-command')

function detectSlash(selection) {
  if (!selection || !selection.empty) return { active: false, query: '', from: 0, to: 0 }
  const $from = selection.$from
  const parent = $from.parent
  if (!parent.isTextblock) return { active: false, query: '', from: 0, to: 0 }
  const text = parent.textBetween(0, $from.parentOffset, '\n', '\ufffc')
  const match = text.match(/\/([\p{L}\p{N}_]*)$/u)
  if (!match) return { active: false, query: '', from: 0, to: 0 }
  return { active: true, query: match[1], from: $from.pos - match[0].length, to: $from.pos }
}

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return { onKeyDown: () => false }
  },
  addProseMirrorPlugins() {
    const onKeyDown = this.options.onKeyDown
    return [
      new Plugin({
        key: slashPluginKey,
        state: {
          init: () => ({ active: false, query: '', from: 0, to: 0 }),
          apply(tr, prev) {
            if (!tr.docChanged && !tr.selectionSet) return prev
            return detectSlash(tr.selection)
          }
        },
        props: {
          handleKeyDown(view, event) {
            const st = slashPluginKey.getState(view.state)
            if (!st || !st.active) return false
            return onKeyDown(view, event, st)
          }
        }
      })
    ]
  }
})

/* ================= Reactive UI state ================= */
const slash = reactive({ open: false, query: '', from: 0, to: 0, left: 0, top: 0, index: 0 })
const colorPicker = reactive({ open: false })
const grip = reactive({ visible: false, left: 0, top: 0, start: null })
let dragSource = null

const PRESET_COLORS = ['#e03131', '#f08c00', '#e6b800', '#2f9e44', '#1971c2', '#7048e8', '#a61e4d', '#343a40']

/* ================= Slash items ================= */
const SLASH_ITEMS = [
  { title: '正文', icon: 'paragraph', keywords: ['text', 'paragraph', '正文'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).setParagraph().run() },
  { title: '标题 1', icon: 'h1', keywords: ['h1', 'heading1', '标题一'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).setHeading({ level: 1 }).run() },
  { title: '标题 2', icon: 'h2', keywords: ['h2', 'heading2', '标题二'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).setHeading({ level: 2 }).run() },
  { title: '标题 3', icon: 'h3', keywords: ['h3', 'heading3', '标题三'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).setHeading({ level: 3 }).run() },
  { title: '无序列表', icon: 'bulletList', keywords: ['ul', 'bullet', '无序列表'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).toggleBulletList().run() },
  { title: '有序列表', icon: 'orderedList', keywords: ['ol', 'ordered', '有序列表'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).toggleOrderedList().run() },
  { title: '待办事项', icon: 'taskList', keywords: ['todo', 'task', '待办'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).toggleTaskList().run() },
  { title: '引用', icon: 'quote', keywords: ['quote', 'blockquote', '引用'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).toggleBlockquote().run() },
  { title: '代码块', icon: 'code', keywords: ['code', '代码'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).toggleCodeBlock().run() },
  { title: '分割线', icon: 'divider', keywords: ['hr', 'divider', '分割线'], run: (ed, s) => ed.chain().focus().deleteRange({ from: s.from, to: s.to }).setHorizontalRule().run() }
]

const filteredItems = computed(() => {
  const q = slash.query.trim().toLowerCase()
  if (!q) return SLASH_ITEMS
  return SLASH_ITEMS.filter((it) =>
    it.title.toLowerCase().includes(q) || it.keywords.some((k) => k.toLowerCase().includes(q))
  )
})

function runSlashItem(item, state) {
  const ed = editor.value
  if (!ed) return
  item.run(ed, state)
  slash.open = false
}

function handleSlashKey(view, event, state) {
  const items = filteredItems.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    slash.index = items.length ? (slash.index + 1) % items.length : 0
    return true
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    slash.index = items.length ? (slash.index - 1 + items.length) % items.length : 0
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    const item = items[slash.index]
    if (item) runSlashItem(item, state)
    else slash.open = false
    return true
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    slash.open = false
    return true
  }
  return false
}

function syncSlash() {
  const ed = editor.value
  if (!ed) return
  const st = slashPluginKey.getState(ed.state)
  if (st && st.active) {
    if (st.query !== slash.query) slash.index = 0
    slash.open = true
    slash.query = st.query
    slash.from = st.from
    slash.to = st.to
    const coords = ed.view.coordsAtPos(st.from)
    slash.left = coords.left
    slash.top = coords.bottom + 8
  } else {
    slash.open = false
  }
}

/* ================= Image handling ================= */
const IMG_PREFIX = 'shiguang-img:'
const blobUrlToId = new Map()
const idToBlobUrl = new Map()

async function storeImageFile(file) {
  console.log('[image-paste] storeImageFile start', file.type, file.size)
  const id = await saveImage(file)
  console.log('[image-paste] saveImage done', id)
  const url = URL.createObjectURL(file)
  blobUrlToId.set(url, id)
  idToBlobUrl.set(id, url)
  return url
}

function getImageFilesFromDataTransfer(dt) {
  if (!dt) return []
  const files = []
  if (dt.items) {
    for (const item of dt.items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
  } else if (dt.files) {
    files.push(...Array.from(dt.files).filter((f) => f.type && f.type.startsWith('image/')))
  }
  return files
}

// Recursively rewrite `shiguang-img:<id>` refs back into blob URLs (async).
async function resolveImageRefs(node) {
  if (!node || typeof node !== 'object') return node
  if (node.type === 'image' && typeof node.attrs?.src === 'string' && node.attrs.src.startsWith(IMG_PREFIX)) {
    const id = node.attrs.src.slice(IMG_PREFIX.length)
    if (!idToBlobUrl.has(id)) {
      const blob = await loadImage(id)
      if (blob) {
        const url = URL.createObjectURL(blob)
        idToBlobUrl.set(id, url)
        blobUrlToId.set(url, id)
      }
    }
    return { ...node, attrs: { ...node.attrs, src: idToBlobUrl.get(id) || node.attrs.src } }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: await Promise.all(node.content.map(resolveImageRefs)) }
  }
  return node
}

// Recursively rewrite blob URLs back into `shiguang-img:<id>` refs for storage.
function serializeDoc(node) {
  if (!node || typeof node !== 'object') return node
  if (node.type === 'image' && typeof node.attrs?.src === 'string') {
    const id = blobUrlToId.get(node.attrs.src)
    if (id) return { ...node, attrs: { ...node.attrs, src: IMG_PREFIX + id } }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map(serializeDoc) }
  }
  return node
}

function insertStoredImage(url) {
  const ed = editor.value
  console.log('[image-paste] insertStoredImage, editor ready:', !!ed, 'url:', url)
  if (!ed) return
  const r1 = ed.chain().focus().setImage({ src: url }).run()
  console.log('[image-paste] setImage result:', r1)
  ed.chain().focus().insertContent({ type: 'paragraph' }).run()
}

async function insertImageFiles(files) {
  for (const f of files) {
    const url = await storeImageFile(f)
    insertStoredImage(url)
  }
}

function handlePaste(view, event) {
  const cd = event.clipboardData
  const files = getImageFilesFromDataTransfer(cd)
  console.log('[image-paste] called', {
    types: cd ? Array.from(cd.types) : null,
    items: cd && cd.items ? Array.from(cd.items).map((i) => ({ kind: i.kind, type: i.type })) : null,
    files: cd && cd.files ? Array.from(cd.files).map((f) => f.type) : null,
    imageFiles: files.length
  })
  if (!files.length) return false
  event.preventDefault()
  insertImageFiles(files).catch((err) => console.error('[image-paste] insert failed:', err))
  return true
}

function handleDrop(view, event) {
  const files = getImageFilesFromDataTransfer(event.dataTransfer)
  if (!files.length) return false
  event.preventDefault()
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (coords) {
    try {
      const $pos = view.state.doc.resolve(Math.min(coords.pos, view.state.doc.content.size))
      view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)))
      view.focus()
    } catch (err) { /* ignore */ }
  }
  insertImageFiles(files)
  return true
}

/* ================= Editor ================= */
let contentReady = false

const editor = useEditor({
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  autofocus: props.autofocus,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, linkOnPaste: true }
    }),
    Placeholder.configure({ placeholder: () => props.placeholder || '输入内容…' }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    Subscript,
    Superscript,
    Image,
    TaskList,
    TaskItem.configure({ nested: true }),
    SlashCommand.configure({ onKeyDown: handleSlashKey })
  ],
  editorProps: {
    handlePaste,
    handleDrop
  },
  onCreate: async ({ editor: ed }) => {
    const resolved = await resolveImageRefs(normalizeContent(props.modelValue))
    ed.commands.setContent(resolved, { emitUpdate: false })
    contentReady = true
  },
  onUpdate: ({ editor: ed }) => {
    emit('update:modelValue', serializeDoc(ed.getJSON()))
  },
  onSelectionUpdate: () => syncSlash(),
  onTransaction: () => syncSlash(),
  onBlur: () => { slash.open = false; grip.visible = false }
})

watch(() => props.modelValue, async (val) => {
  const ed = editor.value
  if (!ed || !contentReady) return
  const resolved = await resolveImageRefs(normalizeContent(val))
  const incoming = JSON.stringify(resolved)
  const current = JSON.stringify(ed.getJSON())
  if (incoming !== current) {
    ed.commands.setContent(resolved, { emitUpdate: false })
  }
})

onBeforeUnmount(() => {
  idToBlobUrl.forEach((url) => { try { URL.revokeObjectURL(url) } catch (err) { /* ignore */ } })
  idToBlobUrl.clear()
  blobUrlToId.clear()
})

/* ================= Drag handle ================= */
const DRAGGABLE = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'horizontalRule'])

function topBlockAtPos(doc, pos) {
  const $pos = doc.resolve(pos)
  if ($pos.depth < 1) return null
  return { start: $pos.start(1), node: $pos.node(1) }
}

function onEditorMouseMove(e) {
  const ed = editor.value
  if (!ed || dragSource != null) return
  const view = ed.view
  const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })
  if (!pos) { grip.visible = false; return }
  const info = topBlockAtPos(view.state.doc, pos.pos)
  if (!info || !DRAGGABLE.has(info.node.type.name)) { grip.visible = false; return }
  const coords = view.coordsAtPos(info.start)
  grip.visible = true
  grip.left = coords.left - 36
  grip.top = coords.top
  grip.start = info.start
}

function onGripDragStart(e) {
  if (grip.start == null) return
  dragSource = grip.start
  e.dataTransfer.effectAllowed = 'move'
  try { e.dataTransfer.setData('text/plain', '') } catch (err) { /* ignore */ }
  grip.visible = false
}

function onGripDragEnd() {
  dragSource = null
}

function moveBlock(fromStart, targetPos) {
  const ed = editor.value
  const { doc } = ed.state
  const node = doc.nodeAt(fromStart)
  if (!node) return
  const end = fromStart + node.nodeSize
  if (targetPos >= fromStart && targetPos <= end) return
  const slice = new Slice(Fragment.from(node), 0, 0)
  const dropPos = dropPoint(doc, targetPos, slice)
  if (dropPos == null) return
  const tr = ed.state.tr
  tr.delete(fromStart, end)
  let insertAt = dropPos
  if (dropPos > fromStart) insertAt -= node.nodeSize
  tr.insert(insertAt, node)
  ed.view.dispatch(tr)
}

function onEditorDrop(e) {
  if (dragSource == null) return
  const ed = editor.value
  if (ed) {
    const pos = ed.view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (pos) moveBlock(dragSource, pos.pos)
  }
  dragSource = null
  grip.visible = false
}

/* ================= Toolbar helpers ================= */
function isActive(name, attrs) {
  return editor.value?.isActive(name, attrs) ?? false
}

const currentColor = computed(() => editor.value?.getAttributes('textStyle').color || '')

const currentAlign = computed(() => {
  const ed = editor.value
  if (!ed) return ''
  return ed.getAttributes('paragraph').textAlign || ed.getAttributes('heading').textAlign || ''
})

function setColor(color) {
  editor.value?.chain().focus().setColor(color).run()
}

function unsetColor() {
  editor.value?.chain().focus().unsetColor().run()
}

function toggleLink() {
  const ed = editor.value
  if (!ed) return
  if (ed.isActive('link')) {
    ed.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  const url = window.prompt('输入链接地址', 'https://')
  if (url === null) return
  const trimmed = url.trim()
  if (!trimmed) return
  ed.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
}

function setAlign(align) {
  editor.value?.chain().focus().setTextAlign(align).run()
}

const alignButtons = [
  { name: 'alignLeft', value: 'left' },
  { name: 'alignCenter', value: 'center' },
  { name: 'alignRight', value: 'right' }
]
</script>

<template>
  <div class="tiptap-wrap">
    <div class="tiptap-toolbar">
      <button type="button" class="tb-btn" title="撤销" :disabled="!editor?.can().undo()" @click="editor?.chain().focus().undo().run()"><Icon name="undo" /></button>
      <button type="button" class="tb-btn" title="重做" :disabled="!editor?.can().redo()" @click="editor?.chain().focus().redo().run()"><Icon name="redo" /></button>
      <span class="tb-sep"></span>
      <button
        v-for="ab in alignButtons"
        :key="ab.value"
        type="button"
        class="tb-btn"
        :class="{ on: currentAlign === ab.value }"
        :title="`对齐：${ab.value}`"
        @click="setAlign(ab.value)"
      ><Icon :name="ab.name" /></button>
      <span class="tb-hint">输入 <kbd>/</kbd> 唤起格式菜单</span>
    </div>

    <div
      class="tiptap-editor"
      @mousemove="onEditorMouseMove"
      @mouseleave="grip.visible = false"
      @dragover.prevent
      @drop.prevent="onEditorDrop"
    >
      <EditorContent :editor="editor" />

      <BubbleMenu v-if="editor" :editor="editor" :options="{ placement: 'top', offset: 6 }">
        <div class="bubble-menu">
          <button type="button" class="bm-btn" :class="{ on: isActive('bold') }" title="加粗" @click="editor?.chain().focus().toggleBold().run()"><Icon name="bold" /></button>
          <button type="button" class="bm-btn" :class="{ on: isActive('italic') }" title="斜体" @click="editor?.chain().focus().toggleItalic().run()"><Icon name="italic" /></button>
          <button type="button" class="bm-btn" :class="{ on: isActive('underline') }" title="下划线" @click="editor?.chain().focus().toggleUnderline().run()"><Icon name="underline" /></button>
          <button type="button" class="bm-btn" :class="{ on: isActive('strike') }" title="删除线" @click="editor?.chain().focus().toggleStrike().run()"><Icon name="strike" /></button>
          <button type="button" class="bm-btn" :class="{ on: isActive('code') }" title="行内代码" @click="editor?.chain().focus().toggleCode().run()"><Icon name="code" /></button>
          <span class="bm-sep"></span>
          <button type="button" class="bm-btn" :class="{ on: isActive('link') }" title="链接" @click="toggleLink"><Icon name="link" /></button>
          <button type="button" class="bm-btn" :class="{ on: isActive('highlight') }" title="高亮" @click="editor?.chain().focus().toggleHighlight({ color: '#ffd43b' }).run()"><Icon name="highlight" /></button>
          <div class="bm-color">
            <button type="button" class="bm-btn" title="文字颜色" @click="colorPicker.open = !colorPicker.open"><Icon name="palette" /></button>
            <div v-if="colorPicker.open" class="color-pop">
              <button
                v-for="c in PRESET_COLORS"
                :key="c"
                type="button"
                class="color-swatch"
                :style="{ background: c }"
                :class="{ on: currentColor === c }"
                @click="setColor(c)"
              ></button>
              <input
                type="color"
                class="color-native"
                :value="currentColor || '#000000'"
                @input="setColor($event.target.value)"
                title="自定义颜色"
              >
              <button type="button" class="color-clear" @click="unsetColor">默认</button>
            </div>
          </div>
        </div>
      </BubbleMenu>

      <Teleport to="body">
        <div v-if="slash.open" class="slash-menu" :style="{ left: slash.left + 'px', top: slash.top + 'px' }">
          <button
            v-for="(item, i) in filteredItems"
            :key="item.title"
            type="button"
            class="slash-item"
            :class="{ active: i === slash.index }"
            @mousedown.prevent="runSlashItem(item, slash)"
            @mouseenter="slash.index = i"
          >
            <span class="si-icon"><Icon :name="item.icon" /></span>
            <span class="si-title">{{ item.title }}</span>
          </button>
          <div v-if="!filteredItems.length" class="slash-empty">无匹配项</div>
        </div>

        <div
          v-if="grip.visible && grip.start != null"
          class="drag-grip"
          :style="{ left: grip.left + 'px', top: grip.top + 'px' }"
          draggable="true"
          title="拖拽调整顺序"
          @dragstart="onGripDragStart"
          @dragend="onGripDragEnd"
        ><Icon name="drag" /></div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.tiptap-wrap { position: relative; }
.tiptap-toolbar {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding: 6px 8px; margin-bottom: 8px;
  background: var(--surface-2); border-radius: var(--radius-sm);
}
.tb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px; border: none;
  background: transparent; color: var(--muted); cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.tb-btn:hover:not(:disabled) { background: var(--surface); color: var(--fg); }
.tb-btn.on { background: var(--accent-soft); color: var(--accent-strong); }
.tb-btn:disabled { opacity: .35; cursor: default; }
.tb-btn svg { width: 16px; height: 16px; }
.tb-sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
.tb-hint { margin-left: auto; color: var(--faint); font-size: 12.5px; }
.tb-hint kbd {
  font-family: inherit; font-size: 12px; color: var(--muted);
  background: var(--surface); border: 1px solid var(--border-strong);
  border-radius: 5px; padding: 0 5px; margin: 0 1px;
}

.tiptap-editor { position: relative; }

/* ---- Bubble menu ---- */
.bubble-menu {
  display: flex; align-items: center; gap: 2px; padding: 5px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 11px;
  box-shadow: var(--shadow-lg);
}
.bm-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 7px; border: none;
  background: transparent; color: var(--muted); cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.bm-btn:hover { background: var(--surface-2); color: var(--fg); }
.bm-btn.on { background: var(--accent-soft); color: var(--accent-strong); }
.bm-btn svg { width: 16px; height: 16px; }
.bm-sep { width: 1px; height: 18px; background: var(--border); margin: 0 3px; }
.bm-color { position: relative; }
.color-pop {
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  display: grid; grid-template-columns: repeat(4, 22px); gap: 5px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 8px; box-shadow: var(--shadow-lg); z-index: 30;
}
.color-swatch {
  width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border);
  cursor: pointer; padding: 0;
}
.color-swatch.on { outline: 2px solid var(--accent); outline-offset: 1px; }
.color-native { grid-column: 1 / -1; width: 100%; height: 26px; border: none; padding: 0; background: none; cursor: pointer; }
.color-clear {
  grid-column: 1 / -1; border: 1px solid var(--border-strong); background: var(--surface);
  border-radius: 6px; font-size: 11px; padding: 3px; cursor: pointer; color: var(--muted);
  font-family: inherit;
}
.color-clear:hover { color: var(--fg); background: var(--surface-2); }

/* ---- Slash menu ---- */
.slash-menu {
  position: fixed; z-index: 80; min-width: 230px; max-height: 340px; overflow-y: auto;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: var(--shadow-lg); padding: 6px;
}
.slash-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 8px 10px; border: none; border-radius: 8px; background: transparent;
  font-family: inherit; font-size: 14px; color: var(--fg); cursor: pointer; text-align: left;
}
.slash-item:hover, .slash-item.active { background: var(--surface-2); }
.si-icon {
  width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); border-radius: 8px; color: var(--muted); flex: none;
}
.si-icon svg { width: 16px; height: 16px; }
.si-title { flex: 1; }
.slash-empty { padding: 14px; color: var(--faint); font-size: 13px; text-align: center; }

/* ---- Drag grip ---- */
.drag-grip {
  position: fixed; z-index: 70;
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  background: var(--surface); color: var(--faint); cursor: grab;
  box-shadow: var(--shadow-sm); opacity: .9;
}
.drag-grip:hover { color: var(--fg); opacity: 1; }
.drag-grip svg { width: 14px; height: 14px; }
</style>
