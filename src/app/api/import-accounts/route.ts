import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import data from './accounts.json'

type Row = { site: string; category: string | null; username: string | null; password: string | null; extra_password: string | null; url: string | null; note: string | null }

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { count } = await supabase.from('accounts').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) return NextResponse.json({ message: `이미 ${count}건이 있습니다. 건너뜁니다.`, inserted: 0 })

  const rows = (data as Row[]).map(r => ({
    site: r.site, category: r.category, username: r.username,
    password: r.password, extra_password: r.extra_password, url: r.url, note: r.note,
  }))
  let inserted = 0
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await supabase.from('accounts').insert(batch)
    if (error) return NextResponse.json({ error: error.message, insertedSoFar: inserted }, { status: 500 })
    inserted += batch.length
  }
  return NextResponse.json({ message: `${inserted}건 임포트 완료!`, inserted })
}
