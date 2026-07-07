import { createClient } from '@supabase/supabase-js'

// iCal 피드: 구글 캘린더 / 애플 캘린더에서 "URL로 구독"하면 앱 일정이 그대로 뜬다.
// 구독 URL 예: https://our-life-app.vercel.app/api/ics?key=<WIDGET_KEY>
// (구독은 읽기 전용 · 구글은 수 시간~하루 주기로 갱신, 애플은 더 자주)
export const dynamic = 'force-dynamic'

function esc(s: string) {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}
function dstamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}
function addDays(ymd: string, n: number) {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (!process.env.WIDGET_KEY || searchParams.get('key') !== process.env.WIDGET_KEY) {
    return new Response('unauthorized', { status: 401 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  // 과거 3개월 ~ 미래 18개월
  const today = new Date()
  const from = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)
  const to = new Date(today.getTime() + 540 * 86400000).toISOString().slice(0, 10)
  const { data } = await supabase.from('events').select('*').gte('date', from).lte('date', to).order('date', { ascending: true })

  const now = dstamp(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//our-life-app//KR', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:우리 집', 'X-WR-TIMEZONE:Asia/Seoul',
  ]
  const PERSON: Record<string, string> = { eddy: 'Eddy', judy: 'Judy', both: '함께' }
  for (const e of (data || [])) {
    const start = e.date.replace(/-/g, '')
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.id}@our-life-app`)
    lines.push(`DTSTAMP:${now}`)
    if (e.time) {
      // 시간 있는 일정 (KST). TZID로 표기
      const [h, m] = e.time.split(':')
      lines.push(`DTSTART;TZID=Asia/Seoul:${start}T${h}${m}00`)
      lines.push(`DTEND;TZID=Asia/Seoul:${start}T${h}${m}00`)
    } else {
      // 종일 일정. 종료일(exclusive) 처리
      const endYmd = e.end_date ? addDays(e.end_date, 1) : addDays(e.date, 1)
      lines.push(`DTSTART;VALUE=DATE:${start}`)
      lines.push(`DTEND;VALUE=DATE:${endYmd}`)
    }
    lines.push(`SUMMARY:${esc(e.title)}`)
    const desc = [PERSON[e.person] ? `[${PERSON[e.person]}]` : '', e.note || ''].filter(Boolean).join(' ')
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
