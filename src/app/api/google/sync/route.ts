import { NextResponse } from 'next/server'
import { admin, getGoogleAuth, setGoogleAuth, getAccessToken } from '@/lib/google'

// 앱 ↔ 구글 캘린더 양방향 동기화.
//  - PUSH: 아직 구글에 없는 앱 일정 → 구글에 생성
//  - PULL: 구글 "우리 집" 캘린더 변경분 → 앱에 반영(신규 생성/수정/삭제)
// 호출: /api/google/sync?key=<WIDGET_KEY>
export const dynamic = 'force-dynamic'

const CAL = (id: string) => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`

function addDays(ymd: string, n: number) {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
type Ev = { id: string; title: string; date: string; end_date?: string | null; time?: string | null; note?: string | null; person: string; google_id?: string | null }

function toGoogleBody(e: Ev) {
  const body: Record<string, unknown> = { summary: e.title, description: e.note || undefined }
  if (e.time) {
    const dt = `${e.date}T${e.time}:00`
    body.start = { dateTime: dt, timeZone: 'Asia/Seoul' }
    body.end = { dateTime: dt, timeZone: 'Asia/Seoul' }
  } else {
    body.start = { date: e.date }
    body.end = { date: e.end_date ? addDays(e.end_date, 1) : addDays(e.date, 1) }
  }
  return body
}

type GStart = { date?: string; dateTime?: string }
function fromGoogle(start: GStart, end?: GStart) {
  if (start.date) {
    let end_date: string | null = null
    if (end?.date) { const ed = addDays(end.date, -1); if (ed !== start.date) end_date = ed }
    return { date: start.date, end_date, time: null as string | null }
  }
  const dt = new Date(start.dateTime!)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(dt)
  const g = (t: string) => parts.find(p => p.type === t)?.value || ''
  let hh = g('hour'); if (hh === '24') hh = '00'
  return { date: `${g('year')}-${g('month')}-${g('day')}`, end_date: null as string | null, time: `${hh}:${g('minute')}` }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const keyOk = !!process.env.WIDGET_KEY && searchParams.get('key') === process.env.WIDGET_KEY
  // 앱에서 로그인된 사용자가 부르는 경우: session 쿠키로도 허용
  const cookie = req.headers.get('cookie') || ''
  const sessionOk = !!process.env.APP_SESSION_SECRET && cookie.split(';').some(c => c.trim() === `session=${process.env.APP_SESSION_SECRET}`)
  // 로그인 게이트 자체가 없는 경우(APP_SESSION_SECRET 미설정)엔 앱 내부 호출 허용
  const gateOff = !process.env.APP_SESSION_SECRET
  if (!keyOk && !sessionOk && !gateOff) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const auth = await getGoogleAuth()
  if (!auth.refresh_token || !auth.calendar_id) {
    return NextResponse.json({ error: 'not_connected', message: '구글 캘린더가 아직 연결되지 않았습니다.' }, { status: 400 })
  }
  const sb = admin()
  let token: string
  try { token = await getAccessToken(auth.refresh_token) }
  catch (e) { return NextResponse.json({ error: 'token', message: String(e) }, { status: 502 }) }

  let pushed = 0, pulledNew = 0, pulledUpd = 0, deleted = 0

  // ── PUSH: 구글에 아직 없는 앱 일정 ──
  const { data: toPush } = await sb.from('events').select('*').is('google_id', null)
  for (const e of (toPush || []) as Ev[]) {
    const r = await fetch(CAL(auth.calendar_id), {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(toGoogleBody(e)),
    })
    const gj = await r.json()
    if (gj.id) { await sb.from('events').update({ google_id: gj.id }).eq('id', e.id); pushed++ }
  }

  // ── PULL: 구글 변경분 ──
  let syncToken = auth.sync_token
  let pageToken: string | undefined
  let nextSyncToken: string | undefined
  let attempts = 0
  do {
    const p = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '250' })
    if (syncToken) p.set('syncToken', syncToken)
    else p.set('timeMin', new Date(Date.now() - 90 * 86400000).toISOString())
    if (pageToken) p.set('pageToken', pageToken)

    const r = await fetch(`${CAL(auth.calendar_id)}?${p}`, { headers: { Authorization: `Bearer ${token}` } })
    const j = await r.json()
    if (j.error) {
      // syncToken 만료(410) → 전체 재동기화
      if (r.status === 410 && syncToken && attempts === 0) { syncToken = undefined; pageToken = undefined; attempts++; continue }
      return NextResponse.json({ error: 'list', message: JSON.stringify(j.error) }, { status: 502 })
    }
    for (const it of (j.items || [])) {
      if (it.status === 'cancelled') {
        const { data: ex } = await sb.from('events').select('id').eq('google_id', it.id).maybeSingle()
        if (ex) { await sb.from('events').delete().eq('id', ex.id); deleted++ }
        continue
      }
      const parsed = fromGoogle(it.start, it.end)
      const { data: ex } = await sb.from('events').select('id').eq('google_id', it.id).maybeSingle()
      if (ex) {
        await sb.from('events').update({ title: it.summary || '(제목 없음)', date: parsed.date, end_date: parsed.end_date, time: parsed.time, note: it.description || null }).eq('id', ex.id)
        pulledUpd++
      } else {
        await sb.from('events').insert({ title: it.summary || '(제목 없음)', date: parsed.date, end_date: parsed.end_date, time: parsed.time, note: it.description || null, person: 'both', google_id: it.id })
        pulledNew++
      }
    }
    pageToken = j.nextPageToken
    nextSyncToken = j.nextSyncToken || nextSyncToken
  } while (pageToken)

  if (nextSyncToken) await setGoogleAuth({ sync_token: nextSyncToken })

  return NextResponse.json({ ok: true, pushed, pulledNew, pulledUpd, deleted, updated: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
