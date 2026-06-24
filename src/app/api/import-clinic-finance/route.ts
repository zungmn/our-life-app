import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import data from './clinic_finance.json'

type Row = {
  date: string
  amount: number
  type: 'income' | 'expense'
  scope: 'hospital' | 'personal' | null
  category: string
  name: string
  is_saving: boolean
}

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 이미 임포트되어 있으면 중단 (중복 방지)
  const { count } = await supabase.from('clinic_finance').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    return NextResponse.json({ message: `이미 ${count}건이 있습니다. 중복 방지를 위해 건너뜁니다.`, inserted: 0 })
  }

  const rows = (data as Row[]).map(r => ({
    date: r.date,
    amount: r.amount,
    type: r.type,
    scope: r.scope,
    category: r.category || '기타',
    name: r.name || null,
    is_saving: r.is_saving,
  }))

  // 500건씩 배치 삽입
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase.from('clinic_finance').insert(batch)
    if (error) return NextResponse.json({ error: error.message, insertedSoFar: inserted }, { status: 500 })
    inserted += batch.length
  }

  return NextResponse.json({ message: `${inserted}건 임포트 완료!`, inserted })
}
