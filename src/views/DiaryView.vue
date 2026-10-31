<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { state, newDiary, editDiary, computeStats, tagCount } from '../store'
import { fmtDate, excerpt, docToText } from '../utils/helpers'
import Icon from '../components/Icon.vue'

const q = computed(() => state.search.trim().toLowerCase())

/* ---- tag filter (multi-select) ---- */
const filterTags = ref(state.tagFilter ? [state.tagFilter] : [])
const tagPanelOpen = ref(false)
const tagSearch = ref('')
const draftTags = ref([])
const tagFilterRef = ref(null)

const allTags = computed(() => {
  const set = new Set()
  state.diaries.forEach((d) => (d.tags || []).forEach((t) => set.add(t)))
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const filteredAllTags = computed(() => {
  const kw = tagSearch.value.trim().toLowerCase()
  if (!kw) return allTags.value
  return allTags.value.filter((t) => t.toLowerCase().includes(kw))
})

/* 卡片上的标签点击：直接切换过滤 */
function toggleFilterTag(t) {
  filterTags.value = filterTags.value.includes(t)
    ? filterTags.value.filter((x) => x !== t)
    : [...filterTags.value, t]
}

/* 面板内勾选：只改草稿，点「完成」才生效 */
function toggleDraftTag(t) {
  draftTags.value = draftTags.value.includes(t)
    ? draftTags.value.filter((x) => x !== t)
    : [...draftTags.value, t]
}

function clearDraftTags() {
  draftTags.value = []
}

function toggleTagPanel() {
  if (tagPanelOpen.value) {
    cancelTagPanel()
    return
  }
  draftTags.value = [...filterTags.value]
  tagPanelOpen.value = true
}

/* 完成：应用草稿 */
function closeTagPanel() {
  filterTags.value = [...draftTags.value]
  tagPanelOpen.value = false
}

/* 取消：丢弃草稿 */
function cancelTagPanel() {
  tagPanelOpen.value = false
}

function clearAllFilters() {
  filterTags.value = []
  tagPanelOpen.value = false
  state.search = ''
  state.tagFilter = null
}

function onDocClick(e) {
  if (tagPanelOpen.value && tagFilterRef.value && !tagFilterRef.value.contains(e.target)) {
    cancelTagPanel()
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const list = computed(() => {
  let l = [...state.diaries].sort((a, b) => b.date.localeCompare(a.date))
  if (filterTags.value.length) {
    l = l.filter((d) => filterTags.value.some((t) => (d.tags || []).includes(t)))
  }
  if (q.value) {
    l = l.filter((d) =>
      d.title.toLowerCase().includes(q.value) ||
      docToText(d.content).toLowerCase().includes(q.value) ||
      (d.tags || []).join(' ').toLowerCase().includes(q.value)
    )
  }
  return l
})

const stats = computed(() => computeStats())
</script>

<template>
  <section class="view">
    <div class="page-head">
      <div>
        <h1 class="page-title">日记</h1>
        <p class="page-sub">{{ filterTags.length ? `已筛选 ${filterTags.length} 个标签 · ${list.length} 篇` : `共 ${state.diaries.length} 篇记录` }}</p>
      </div>
      <button class="btn btn-primary" @click="newDiary()"><Icon name="plus" /> 新建日记</button>
    </div>

    <div class="toolbar">
      <div class="search">
        <Icon name="search" />
        <input v-model="state.search" type="text" placeholder="搜索标题、内容或标签…">
      </div>

      <div class="tag-filter" ref="tagFilterRef">
        <button
          type="button"
          class="tag-filter-btn"
          :class="{ active: filterTags.length > 0 }"
          :aria-expanded="tagPanelOpen"
          @click="toggleTagPanel"
        >
          <Icon name="tag" />
          标签过滤
          <span v-if="filterTags.length" class="tag-filter-count">{{ filterTags.length }}</span>
        </button>

        <div v-if="tagPanelOpen" class="tag-filter-popover" @click.stop>
          <div class="tag-modal-search">
            <Icon name="search" />
            <input v-model="tagSearch" type="text" placeholder="搜索标签…">
          </div>
          <div class="tag-filter-scroll">
            <div v-if="!filteredAllTags.length" class="tag-modal-empty">
              <p>没有匹配的标签</p>
            </div>
            <div v-else class="tag-modal-grid">
              <button
                v-for="t in filteredAllTags"
                :key="t"
                type="button"
                class="tag-modal-option"
                :class="{ on: draftTags.includes(t) }"
                @click="toggleDraftTag(t)"
              >
                <span class="mark"><Icon v-if="draftTags.includes(t)" name="check" /></span>
                <span class="n">{{ t }}</span>
                <span class="cnt">{{ tagCount(t) }} 篇</span>
              </button>
            </div>
          </div>
          <div class="tag-filter-foot">
            <button type="button" class="btn btn-ghost btn-sm" @click="clearDraftTags">清除</button>
            <button type="button" class="btn btn-primary btn-sm" @click="closeTagPanel">完成</button>
          </div>
        </div>
      </div>

      <button v-if="filterTags.length" class="btn btn-ghost btn-sm" @click="clearAllFilters">清除筛选 ×</button>
    </div>

    <div class="diary-layout">
      <div>
        <div v-if="list.length" class="entry-list">
          <div v-for="d in list" :key="d.id" class="card entry-card" @click="editDiary(d.id)">
            <div class="entry-top" :class="{ 'entry-top--untitled': !(d.title && d.title.trim()) }">
              <h3 v-if="d.title && d.title.trim()" class="entry-title">{{ d.title }}</h3>
              <div v-else class="entry-tags entry-tags-inline">
                <span v-for="t in (d.tags || [])" :key="t" class="tag-pill" :class="{ on: filterTags.includes(t) }" @click.stop="toggleFilterTag(t)">{{ t }}</span>
              </div>
              <span class="entry-date">{{ fmtDate(d.date) }}</span>
            </div>
            <div v-if="state.settings.showListExcerpt" class="entry-excerpt">{{ excerpt(d.content, 60) }}</div>
            <div v-if="d.title && d.title.trim()" class="entry-tags">
              <span v-for="t in (d.tags || [])" :key="t" class="tag-pill" :class="{ on: filterTags.includes(t) }" @click.stop="toggleFilterTag(t)">{{ t }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty">
          <Icon name="search" />
          <p>没有找到匹配的日记</p>
          <button class="btn btn-ghost" @click="clearAllFilters">清除筛选</button>
        </div>
      </div>

      <div class="card stats">
        <h3>统计</h3>
        <div class="stat-row"><span class="k">日记数</span><span class="v">{{ stats.total }}</span></div>
        <div class="stat-row"><span class="k">总字数</span><span class="v">{{ stats.words }}</span></div>
        <div class="stat-row"><span class="k">活跃天数</span><span class="v">{{ stats.activeDays }}</span></div>
        <div class="stat-row"><span class="k">最早日期</span><span class="v" style="font-size:13px">{{ stats.earliest }}</span></div>
        <div class="stat-row"><span class="k">最后日期</span><span class="v" style="font-size:13px">{{ stats.latest }}</span></div>
      </div>
    </div>
  </section>
</template>
