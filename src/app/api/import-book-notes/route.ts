import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import notes from './books_notes.json'

type BookNote = { title: string; notes: string; quote: string }

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 현재 DB의 책 목록 (제목 → id)
  const { data: existing, error: fetchErr } = await supabase.from('books').select('id, title')
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const titleToId = new Map<string, string>()
  for (const b of existing || []) titleToId.set(b.title, b.id)

  let updated = 0
  const notFound: string[] = []
  const failed: string[] = []

  for (const item of notes as BookNote[]) {
    const id = titleToId.get(item.title)
    if (!id) { notFound.push(item.title); continue }
    const payload: { notes?: string; quote?: string } = {}
    if (item.notes) payload.notes = item.notes
    if (item.quote) payload.quote = item.quote
    if (Object.keys(payload).length === 0) continue
    const { error } = await supabase.from('books').update(payload).eq('id', id)
    if (error) { failed.push(`${item.title}: ${error.message}`); continue }
    updated++
  }

  return NextResponse.json({
    message: `${updated}권에 독후감/구절 적용 완료!`,
    updated,
    notFound,
    failed,
  })
}
