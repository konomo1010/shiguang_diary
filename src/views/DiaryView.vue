<script setup>
import { computed } from 'vue'
import { state, newDiary, editDiary, filterByTag, clearTagFilter, clearFilters, computeStats } from '../store'
import { fmtDate, excerpt, docToText } from '../utils/helpers'
import Icon from '../components/Icon.vue'

const q = computed(() => state.search.trim().toLowerCase())

const list = computed(() => {
  let l = [...state.diaries].sort((a, b) => b.date.localeCompare(a.date))
  if (state.tagFilter) l = l.filter((d) => (d.tags || []).includes(state.tagFilter))
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
        <p class="page-sub">{{ state.tagFilter ? `标签「${state.tagFilter}」下的 ${list.length} 篇` : `共 ${state.diaries.length} 篇记录` }}</p>
      </div>
      <button class="btn btn-primary" @click="newDiary()"><Icon name="plus" /> 新建日记</button>
    </div>

    <div class="toolbar">
      <div class="search">
        <Icon name="search" />
        <input v-model="state.search" type="text" placeholder="搜索标题、内容或标签…">
      </div>
      <button v-if="state.tagFilter" class="btn btn-ghost btn-sm" @click="clearTagFilter">清除筛选「{{ state.tagFilter }}」×</button>
    </div>

    <div class="diary-layout">
      <div>
        <div v-if="list.length" class="entry-list">
          <div v-for="d in list" :key="d.id" class="card entry-card" @click="editDiary(d.id)">
            <div class="entry-top" :class="{ 'entry-top--untitled': !(d.title && d.title.trim()) }">
              <h3 v-if="d.title && d.title.trim()" class="entry-title">{{ d.title }}</h3>
              <div v-else class="entry-tags entry-tags-inline">
                <span v-for="t in (d.tags || [])" :key="t" class="tag-pill" @click.stop="filterByTag(t)">{{ t }}</span>
              </div>
              <span class="entry-date">{{ fmtDate(d.date) }}</span>
            </div>
            <div v-if="state.settings.showListExcerpt" class="entry-excerpt">{{ excerpt(d.content, 60) }}</div>
            <div v-if="d.title && d.title.trim()" class="entry-tags">
              <span v-for="t in (d.tags || [])" :key="t" class="tag-pill" @click.stop="filterByTag(t)">{{ t }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty">
          <Icon name="search" />
          <p>没有找到匹配的日记</p>
          <button class="btn btn-ghost" @click="clearFilters">清除筛选</button>
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