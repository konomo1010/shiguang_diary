<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  state, userAvatarChar, load,
  setTheme, setShowListExcerpt,
  setUserName, setUserAvatar, exportData, importData
} from '../store'
import * as dbApi from '../api'
import Icon from '../components/Icon.vue'
import { open } from '@tauri-apps/plugin-dialog'

// 数据导入 / 导出

const avatarPreview = computed(() => userAvatarChar())
const isImageAvatar = computed(() => (state.user.avatar || '').startsWith('data:image/'))

function pickAvatarImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const f = input.files?.[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      if (url) setUserAvatar(url)
    }
    reader.readAsDataURL(f)
    input.remove()
  }
  input.click()
}

// 数据目录配置
const dataDir = ref('')
const dataDirSaved = ref(false)

onMounted(async () => {
  try {
    dataDir.value = await dbApi.getDataDir()
  } catch (e) {
    console.error('[settings] get data dir failed', e)
  }
})

async function applyDataDir(path) {
  try {
    const newRoot = await dbApi.setDataDir(path)
    await load()  // 迁移后立即从新目录重新加载数据
    dataDir.value = newRoot || '(默认：运行目录/data)'
    dataDirSaved.value = true
    setTimeout(() => { dataDirSaved.value = false }, 3000)
  } catch (e) {
    console.error('[settings] set data dir failed', e)
  }
}

async function pickDataDir() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择数据目录',
  })
  if (!selected) return
  await applyDataDir(selected)
}

function resetDataDir() {
  applyDataDir('')
}
</script>

<template>
  <section class="view">
    <div class="page-head">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-sub">个性化你的写作体验</p>
      </div>
    </div>

    <div class="settings-group">
      <h3>用户信息</h3>
      <p class="desc">设置头像与用户名，显示在侧栏底部与首页问候中。</p>
      <div class="setting-row">
        <div class="info"><b>用户名</b><span>显示在侧栏底部与首页问候中</span></div>
        <input type="text" class="text-input" :value="state.user.name" maxlength="12" @change="setUserName($event.target.value)">
      </div>
      <div class="setting-row">
        <div class="info"><b>头像</b><span>可用文字或图片，留空则自动取用户名首字</span></div>
        <div class="avatar-config">
          <div class="avatar">
            <img v-if="isImageAvatar" :src="state.user.avatar" alt="" class="avatar-img">
            <template v-else>{{ avatarPreview }}</template>
          </div>
          <input v-if="!isImageAvatar" type="text" class="text-input avatar-input" :value="state.user.avatar" maxlength="1" placeholder="自动" @input="setUserAvatar($event.target.value)">
          <button type="button" class="btn btn-ghost" @click="pickAvatarImage"><Icon name="image" /> 选择图片</button>
          <button v-if="isImageAvatar" type="button" class="btn-link" @click="setUserAvatar('')">恢复文字</button>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <h3>外观</h3>
      <p class="desc">选择主题。</p>
      <div class="setting-row">
        <div class="info"><b>主题模式</b><span>切换浅色 / 深色界面</span></div>
        <div class="theme-seg">
          <button :class="{ active: state.settings.theme === 'light' }" @click="setTheme('light')"><Icon name="sun" /> 浅色</button>
          <button :class="{ active: state.settings.theme === 'dark' }" @click="setTheme('dark')"><Icon name="moon" /> 深色</button>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <h3>偏好</h3>
      <p class="desc">列表展示相关的设置。</p>
      <div class="setting-row">
        <div class="info"><b>列表内容摘要</b><span>在日记列表中展示正文摘要文字</span></div>
        <label class="switch"><input type="checkbox" :checked="state.settings.showListExcerpt" @change="setShowListExcerpt($event.target.checked)"><span class="track"></span></label>
      </div>
    </div>

    <div class="settings-group">
      <h3>数据</h3>
      <p class="desc">数据目录、导入与导出。</p>
      <div class="setting-row">
        <div class="info">
          <b>数据目录</b>
          <span>当前：{{ dataDir }}。选择新目录后数据会自动迁移。</span>
        </div>
        <div class="data-dir-config">
          <button type="button" class="btn btn-ghost" @click="pickDataDir"><Icon name="folder" /> 选择目录</button>
          <button type="button" class="btn-link" @click="resetDataDir">恢复默认</button>
          <span v-if="dataDirSaved" class="saved-tip">已迁移</span>
        </div>
      </div>
      <div class="setting-row">
        <div class="info"><b>导出数据</b><span>下载全部日记为 JSON 文件</span></div>
        <button class="btn btn-ghost" @click="exportData"><Icon name="download" /> 导出</button>
      </div>
      <div class="setting-row">
        <div class="info"><b>导入数据</b><span>从 JSON 文件恢复日记与标签</span></div>
        <button class="btn btn-ghost" @click="importData"><Icon name="upload" /> 导入</button>
      </div>
    </div>

  </section>
</template>