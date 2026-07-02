import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import data from './gifts.json'

type Row = { name: string; amount: number; date: string | null; method: string | null; thanked: boolean; repaid: boolean; note: string | null }

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { count } = await supabase.from('wedding_gifts').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) return NextResponse.json({ message: `이미 ${count}건이 있습니다. 건너뜁니다.`, inserted: 0 })

  const rows = (data as Row[]).map(r => ({
    name: r.name, amount: r.amount || 0, date: r.date, method: r.method,
    thanked: !!r.thanked, repaid: !!r.repaid, note: r.note,
  }))
  let inserted = 0
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await supabase.from('wedding_gifts').insert(batch)
    if (error) return NextResponse.json({ error: error.message, insertedSoFar: inserted }, { status: 500 })
    inserted += batch.length
  }
  return NextResponse.json({ message: `${inserted}건 임포트 완료!`, inserted })
}
