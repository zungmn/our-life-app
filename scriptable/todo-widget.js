// ─────────────────────────────────────────────
//  우리 집 · Todo 위젯 (애플 '미리알림' 스타일)
//  아이폰 Scriptable 앱에 이 스크립트를 새로 만들어 붙여넣으세요.
//  아래 3개 값만 본인 것으로 바꾸면 됩니다.
// ─────────────────────────────────────────────
const BASE_URL = "https://our-life-app.vercel.app"   // 앱 주소
const KEY      = "여기에_WIDGET_KEY_붙여넣기"          // Vercel 환경변수 WIDGET_KEY 와 동일하게
const VIEWER   = "eddy"                                // "eddy" 또는 "judy"
// ─────────────────────────────────────────────

const ACCENT = new Color("#3B82F6")   // 파랑 포인트
const RED    = new Color("#EF4444")
const GRAY   = new Color("#94A3B8")

async function loadTodos() {
  const url = `${BASE_URL}/api/widget/todos?key=${encodeURIComponent(KEY)}&viewer=${VIEWER}`
  const req = new Request(url)
  const json = await req.loadJSON()
  return json.todos || []
}

function daysLeftLabel(deadline) {
  if (!deadline) return { text: "", color: GRAY }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(deadline + "T00:00:00")
  const diff = Math.round((d - today) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)}일 지남`, color: RED }
  if (diff === 0) return { text: "오늘", color: RED }
  if (diff === 1) return { text: "내일", color: new Color("#F59E0B") }
  return { text: `D-${diff}`, color: GRAY }
}

const widget = new ListWidget()
widget.backgroundColor = new Color("#FFFFFF")
widget.setPadding(14, 14, 14, 14)
widget.url = BASE_URL + "/todos"

const header = widget.addStack()
const title = header.addText("📋 Todo")
title.font = Font.boldSystemFont(15)
title.textColor = new Color("#1E293B")
header.addSpacer()
widget.addSpacer(6)

try {
  const todos = await loadTodos()
  const family = config.widgetFamily || "medium"
  const max = family === "large" ? 12 : family === "small" ? 3 : 5

  if (todos.length === 0) {
    const t = widget.addText("할 일이 없어요 🎉")
    t.font = Font.systemFont(12); t.textColor = GRAY
  } else {
    for (const todo of todos.slice(0, max)) {
      const row = widget.addStack()
      row.centerAlignContent()
      const bullet = row.addText("○ ")
      bullet.font = Font.systemFont(13); bullet.textColor = ACCENT
      const label = row.addText(todo.title)
      label.font = Font.systemFont(13); label.textColor = new Color("#334155")
      label.lineLimit = 1
      row.addSpacer()
      const dl = daysLeftLabel(todo.deadline)
      if (dl.text) {
        const due = row.addText(dl.text)
        due.font = Font.mediumSystemFont(11); due.textColor = dl.color
      }
      widget.addSpacer(4)
    }
    if (todos.length > max) {
      const more = widget.addText(`+${todos.length - max} 더보기`)
      more.font = Font.systemFont(11); more.textColor = GRAY
    }
  }
} catch (e) {
  const t = widget.addText("불러오기 실패\n" + String(e))
  t.font = Font.systemFont(11); t.textColor = RED
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
