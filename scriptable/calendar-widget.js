// ─────────────────────────────────────────────
//  우리 집 · 캘린더 위젯 (구글 캘린더 스타일)
//  아이폰 Scriptable 앱에 새 스크립트로 붙여넣으세요.
//  아래 2개 값만 본인 것으로 바꾸면 됩니다.
// ─────────────────────────────────────────────
const BASE_URL = "https://our-life-app.vercel.app"
const KEY      = "여기에_WIDGET_KEY_붙여넣기"
// ─────────────────────────────────────────────

const PERSON = {
  eddy: new Color("#3B82F6"),   // 파랑
  judy: new Color("#EAB308"),   // 노랑
  both: new Color("#10B981"),   // 초록
}
const GRAY = new Color("#94A3B8")
const WD = ["일", "월", "화", "수", "목", "금", "토"]

async function loadEvents(days) {
  const url = `${BASE_URL}/api/widget/calendar?key=${encodeURIComponent(KEY)}&days=${days}`
  return await new Request(url).loadJSON()
}

function fmtTime(t) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const ap = h < 12 ? "오전" : "오후"
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${ap} ${hh}:${String(m).padStart(2, "0")}`
}
function dayHeader(dateStr) {
  const d = new Date(dateStr + "T00:00:00")
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((d - today) / 86400000)
  const rel = diff === 0 ? "오늘" : diff === 1 ? "내일" : `${d.getMonth() + 1}.${d.getDate()}`
  return `${rel} (${WD[d.getDay()]})`
}

const widget = new ListWidget()
widget.backgroundColor = new Color("#FFFFFF")
widget.setPadding(14, 14, 14, 14)
widget.url = BASE_URL + "/calendar"

const family = config.widgetFamily || "medium"
const maxRows = family === "large" ? 12 : family === "small" ? 3 : 5

const head = widget.addStack()
const today = new Date()
const ht = head.addText(`📅 ${today.getMonth() + 1}월 ${today.getDate()}일`)
ht.font = Font.boldSystemFont(15); ht.textColor = new Color("#1E293B")
head.addSpacer()
widget.addSpacer(6)

try {
  const data = await loadEvents(family === "large" ? 30 : 14)
  const events = data.events || []
  if (events.length === 0) {
    const t = widget.addText("다가오는 일정이 없어요")
    t.font = Font.systemFont(12); t.textColor = GRAY
  } else {
    let lastDay = ""
    let rows = 0
    for (const ev of events) {
      if (rows >= maxRows) break
      if (ev.date !== lastDay) {
        if (lastDay) widget.addSpacer(4)
        const dh = widget.addText(dayHeader(ev.date))
        dh.font = Font.mediumSystemFont(11); dh.textColor = GRAY
        widget.addSpacer(2)
        lastDay = ev.date
      }
      const row = widget.addStack()
      row.centerAlignContent()
      const dot = row.addText("●")
      dot.font = Font.systemFont(9); dot.textColor = PERSON[ev.person] || GRAY
      row.addSpacer(5)
      const label = row.addText(ev.title)
      label.font = Font.systemFont(13); label.textColor = new Color("#334155")
      label.lineLimit = 1
      row.addSpacer()
      if (ev.time) {
        const tm = row.addText(fmtTime(ev.time))
        tm.font = Font.systemFont(11); tm.textColor = GRAY
      }
      widget.addSpacer(3)
      rows++
    }
  }
} catch (e) {
  const t = widget.addText("불러오기 실패\n" + String(e))
  t.font = Font.systemFont(11); t.textColor = new Color("#EF4444")
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
