<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { $prose, replaceAll } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import Icon from './Icon.vue'

const currentLineKey = new PluginKey('crepe-current-line')

function currentLineDecorations(state) {
  const { selection } = state
  if (!selection || !selection.empty) return DecorationSet.empty

  const $from = selection.$from
  let depth = $from.depth
  while (depth > 0 && !$from.node(depth).isBlock) depth--

  const start = $from.start(depth)
  const end = $from.end(depth)
  if (start >= end) return DecorationSet.empty

  return DecorationSet.create(state.doc, [
    Decoration.node(start, end, {}, { class: 'crepe-current-line' })
  ])
}

const currentLinePlugin = $prose(() => new Plugin({
  key: currentLineKey,
  state: {
    init(_config, state) {
      return currentLineDecorations(state)
    },
    apply(_tr, _old, _oldState, newState) {
      return currentLineDecorations(newState)
    }
  },
  props: {
    decorations(state) {
      return currentLineKey.getState(state) || DecorationSet.empty
    }
  }
}))

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  autofocus: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const rootEl = ref(null)
let crepe = null

const viewMode = ref('wysiwyg') // 'wysiwyg' | 'source'
const sourceText = ref('')
const editorReady = ref(false)

async function toggleMode() {
  if (!crepe) return
  if (viewMode.value === 'wysiwyg') {
    // Switch to source: read current markdown from the editor.
    sourceText.value = await crepe.getMarkdown()
    viewMode.value = 'source'
  } else {
    // Switch back to WYSIWYG: load the source markdown into the editor.
    await crepe.editor.action(replaceAll(sourceText.value))
    emit('update:modelValue', sourceText.value)
    viewMode.value = 'wysiwyg'
  }
}

// Keep the parent v-model in sync while editing in source mode.
watch(sourceText, (val) => {
  if (viewMode.value === 'source') emit('update:modelValue', val)
})

onMounted(async () => {
  const featureConfigs = {}
  if (props.placeholder) {
    featureConfigs.placeholder = { text: props.placeholder }
  }

  crepe = new Crepe({
    root: rootEl.value,
    defaultValue: props.modelValue,
    features: {
      'top-bar': true,      // enable the persistent top toolbar
      'code-mirror': false, // no code editing in a diary; saves bundle size
      'latex': false        // no math formulas in a diary; saves bundle size
    },
    featureConfigs
  })

  // Register the current-line highlight plugin before creating the editor.
  crepe.editor.use(currentLinePlugin)

  // Sync markdown changes back to the parent (v-model).
  crepe.on((api) => {
    api.markdownUpdated((_ctx, markdown) => {
      emit('update:modelValue', markdown)
    })
  })

  try {
    await crepe.create()
    editorReady.value = true
    if (props.autofocus) {
      const pm = rootEl.value && rootEl.value.querySelector('.ProseMirror')
      if (pm) pm.focus()
    }
  } catch (e) {
    console.error('[CrepeEditor] failed to create editor:', e)
  }
})

onBeforeUnmount(() => {
  if (crepe) {
    try {
      crepe.destroy()
    } catch (e) { /* ignore */ }
    crepe = null
  }
})
</script>

<template>
  <div class="crepe-editor-wrap">
    <div v-show="viewMode === 'wysiwyg'" ref="rootEl" class="crepe-editor"></div>
    <textarea
      v-show="viewMode === 'source'"
      v-model="sourceText"
      class="crepe-source"
      :placeholder="placeholder"
      spellcheck="false"
    ></textarea>
    <Teleport
      v-if="editorReady"
      to=".milkdown-top-bar .top-bar-inner"
      :disabled="viewMode === 'source'"
    >
      <button
        type="button"
        class="crepe-mode-toggle"
        :title="viewMode === 'wysiwyg' ? '源码模式' : '所见即所得'"
        @click="toggleMode"
      >
        <Icon :name="viewMode === 'wysiwyg' ? 'code' : 'eye'" />
      </button>
    </Teleport>
  </div>
</template>