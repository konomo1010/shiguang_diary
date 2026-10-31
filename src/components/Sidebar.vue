<script setup>
import { computed } from 'vue'
import { state, showView, userAvatarChar } from '../store'
import { NAV_ITEMS } from '../utils/icons'
import Icon from './Icon.vue'

const diaryCount = computed(() => state.diaries.length)
</script>

<template>
  <aside class="sidebar">
    <nav class="nav">
      <button
        v-for="n in NAV_ITEMS"
        :key="n.id"
        class="nav-item"
        :class="{ active: state.view === n.id }"
        @click="showView(n.id)"
      >
        <Icon :name="n.icon" /><span>{{ n.label }}</span>
        <span v-if="n.id === 'diary'" class="nav-badge">{{ diaryCount }}</span>
      </button>
    </nav>
    <div class="sidebar-spacer"></div>
    <div class="sidebar-foot">
      <div class="user">
        <div class="avatar">{{ userAvatarChar() }}</div>
        <div class="user-meta">
          <b>{{ state.user.name || '拾光用户' }}</b>
        </div>
      </div>
    </div>
  </aside>
</template>