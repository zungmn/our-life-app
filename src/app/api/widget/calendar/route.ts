import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Scriptable(아이폰 위젯)용 캘린더 JSON. 오늘부터 N일간의 일정.
// 호출: /api/widget/calendar?key=<WIDGET_KEY>&days=14
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!process.env.WIDGET_KEY || key !== process.env.WIDGET_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const days = Math.min(60, Math.max(1, parseInt(searchParams.get('days') || '14', 10)))

  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const from = iso(today)
  const to = iso(new Date(today.getTime() + days * 86400000))

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  // 시작일이 범위 안이거나, 여러 날 일정이 범위와 겹치는 경우
  const { data } = await supabase.from('events').select('*')
    .or(`and(date.gte.${from},date.lte.${to}),and(date.lte.${from},end_date.gte.${from})`)
    .order('date', { ascending: true })

  const events = (data || [])
    .map(e => ({ date: e.date, end_date: e.end_date || null, title: e.title, time: e.time || null, person: e.person }))
    .sort((a, b) => a.date === b.date ? (a.time || '').localeCompare(b.time || '') : (a.date < b.date ? -1 : 1))
    .slice(0, 40)

  return NextResponse.json({ from, to, updated: new Date().toISOString(), events }, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  })
}
