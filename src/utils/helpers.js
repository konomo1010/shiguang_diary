export const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

export const todayStr = () => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export const toDateStr = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export const weekdayOf = (dateStr) => WEEKDAYS[new Date(dateStr + "T00:00:00").getDay()]

export const fmtDate = (dateStr) => `${dateStr} · ${weekdayOf(dateStr)}`

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

export const countWords = (s) => (s || "").replace(/\s/g, "").length

export const excerpt = (content, len = 40) => {
  const clean = (content || "").replace(/\s+/g, " ").trim()
  return clean.length > len ? clean.slice(0, len) + "…" : clean
}

export const greeting = () => {
  const h = new Date().getHours()
  if (h < 6) return "夜深了"
  if (h < 11) return "早上好"
  if (h < 14) return "中午好"
  if (h < 18) return "下午好"
  return "晚上好"
}