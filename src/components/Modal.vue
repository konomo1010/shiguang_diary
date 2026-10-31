<script setup>
import { ref, watch, nextTick } from 'vue'
import { modal, closeModal, confirmModal } from '../store'

const inputEl = ref(null)

watch(() => modal.open, (open) => {
  if (open && modal.input) {
    nextTick(() => { if (inputEl.value) inputEl.value.focus() })
  }
})

function onKeydown(e) {
  if (e.key === 'Enter') confirmModal()
}
</script>

<template>
  <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <h3>{{ modal.title }}</h3>
      <p>{{ modal.body }}</p>
      <input
        v-if="modal.input"
        ref="inputEl"
        v-model="modal.inputValue"
        type="text"
        :placeholder="modal.inputPlaceholder"
        maxlength="20"
        @keydown="onKeydown"
      >
      <div class="modal-actions">
        <button class="btn btn-ghost" @click="closeModal">取消</button>
        <button
          class="btn"
          :class="modal.danger ? 'btn-danger' : 'btn-primary'"
          @click="confirmModal"
        >{{ modal.confirmText }}</button>
      </div>
    </div>
  </div>
</template>