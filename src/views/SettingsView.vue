<script setup>
import { computed } from 'vue'
import {
  state, configDirName, userAvatarChar,
  setTheme, setFontSize, setAutosave, setReminders, setShowListExcerpt,
  setUserName, setUserAvatar, exportData, clearAll,
  chooseConfigDir, clearConfigDir, saveConfig, importConfig
} from '../store'
import Icon from '../components/Icon.vue'

const avatarPreview = computed(() => userAvatarChar())
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
        <div class="info"><b>头像</b><span>显示一个字符，留空则自动取用户名首字</span></div>
        <div class="avatar-config">
          <div class="avatar">{{ avatarPreview }}</div>
          <input type="text" class="text-input avatar-input" :value="state.user.avatar" maxlength="1" placeholder="自动" @input="setUserAvatar($event.target.value)">
        </div>
      </div>
    </div>

    <div class="settings-group">
      <h3>外观</h3>
      <p class="desc">选择主题与正文字号。</p>
      <div class="setting-row">
        <div class="info"><b>主题模式</b><span>切换浅色 / 深色界面</span></div>
        <div class="theme-seg">
          <button :class="{ active: state.settings.theme === 'light' }" @click="setTheme('light')"><Icon name="sun" /> 浅色</button>
          <button :class="{ active: state.settings.theme === 'dark' }" @click="setTheme('dark')"><Icon name="moon" /> 深色</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="info"><b>正文字号</b><span>调整日记内容的显示大小</span></div>
        <input type="range" min="13" max="20" step="1" :value="state.settings.fontSize" @input="setFontSize($event.target.value)">
        <span class="range-val">{{ state.settings.fontSize }}px</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>偏好</h3>
      <p class="desc">写作与提醒相关的行为设置。</p>
      <div class="setting-row">
        <div class="info"><b>自动保存</b><span>离开编辑器前自动保存草稿</span></div>
        <label class="switch"><input type="checkbox" :checked="state.settings.autosave" @change="setAutosave($event.target.checked)"><span class="track"></span></label>
      </div>
      <div class="setting-row">
        <div class="info"><b>每日提醒</b><span>每天晚上提醒你写一篇日记</span></div>
        <label class="switch"><input type="checkbox" :checked="state.settings.reminders" @change="setReminders($event.target.checked)"><span class="track"></span></label>
      </div>
      <div class="setting-row">
        <div class="info"><b>列表内容摘要</b><span>在日记列表中展示正文摘要文字</span></div>
        <label class="switch"><input type="checkbox" :checked="state.settings.showListExcerpt" @change="setShowListExcerpt($event.target.checked)"><span class="track"></span></label>
      </div>
    </div>

    <div class="settings-group">
      <h3>数据</h3>
      <p class="desc">导出或管理你的日记数据（保存在本机浏览器中）。</p>
      <div class="setting-row">
        <div class="info"><b>导出数据</b><span>下载全部日记为 JSON 文件</span></div>
        <button class="btn btn-ghost" @click="exportData"><Icon name="download" /> 导出</button>
      </div>
      <div class="setting-row">
        <div class="info"><b>清空数据</b><span>删除所有日记与标签，不可恢复</span></div>
        <button class="btn btn-danger-ghost" @click="clearAll"><Icon name="trash" /> 清空</button>
      </div>
    </div>

    <div class="settings-group">
      <h3>配置</h3>
      <p class="desc">配置文件的保存位置，以及导入 / 导出当前设置。</p>
      <div class="setting-row">
        <div class="info"><b>保存位置</b><span>{{ configDirName ? '固定文件夹：' + configDirName : '未设置（保存时询问或下载到默认目录）' }}</span></div>
        <div class="row-actions">
          <button v-if="configDirName" class="btn-link" @click="clearConfigDir">恢复默认</button>
          <button class="btn btn-ghost" @click="chooseConfigDir"><Icon name="folder" /> {{ configDirName ? '更改' : '选择文件夹' }}</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="info"><b>导入配置</b><span>从 diary_config.json 恢复设置</span></div>
        <button class="btn btn-ghost" @click="importConfig"><Icon name="upload" /> 导入配置</button>
      </div>
      <div class="setting-row">
        <div class="info"><b>保存配置</b><span>将当前配置选项记录到配置文件</span></div>
        <button class="btn btn-primary" @click="saveConfig"><Icon name="save" /> 保存配置</button>
      </div>
    </div>
  </section>
</template>