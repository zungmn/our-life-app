import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Scriptable(아이폰 위젯)용 Todo JSON.
// 호출: /api/widget/todos?key=<WIDGET_KEY>&viewer=eddy
// Vercel 환경변수 WIDGET_KEY 를 설정하고, 같은 값을 Scriptable 스크립트에 넣는다.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!process.env.WIDGET_KEY || key !== process.env.WIDGET_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const viewer = (searchParams.get('viewer') === 'judy' ? 'judy' : 'eddy') as 'eddy' | 'judy'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase.from('todos').select('*').eq('completed', false)
  const vis = (v: string) => viewer === 'eddy' ? (v === 'eddy' || v === 'both') : (v === 'judy' || v === 'both')
  const todos = (data || [])
    .filter(t => vis(t.visibility))
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline < b.deadline ? -1 : 1
    })
    .slice(0, 20)
    .map(t => ({ title: t.title, deadline: t.deadline || null, owner: t.owner || null, shared: t.visibility === 'both' }))

  return NextResponse.json({ viewer, updated: new Date().toISOString(), todos }, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  })
}
