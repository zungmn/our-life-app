'use client'

import { useEffect, useState } from 'react'
import { supabase, Book } from '@/lib/supabase'
import { Plus, X, Trash2, Star } from 'lucide-react'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const GENRES = ['자기계발', '경영/경제', '마케팅', '인문', '철학', '심리', '과학', '역사', '소설', '에세이', '건강', '육아', '종교', '기타']

const BOOK_STATUS_COLORS: Record<string, string> = {
  want_to_read: '#94A3B8',
  reading: '#3B82F6',
  completed: '#10B981',
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [tab, setTab] = useState<'all' | 'yearly' | 'stats'>('all')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Book | null>(null)
  const [form, setForm] = useState({
    title: '', author: '', cover_url: '', genre: '자기계발',
    status: 'reading' as Book['status'],
    rating: 0, notes: '', quote: '',
    date_started: '', date_finished: ''
  })
  const [loading, setLoading] = useState(false)

  const fetchBooks = async () => {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false })
    setBooks(data || [])
  }

  useEffect(() => { fetchBooks() }, [])

  const handleSave = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    await supabase.from('books').insert({
      title: form.title, author: form.author || null, cover_url: form.cover_url || null,
      status: form.status, rating: form.rating || null, notes: form.notes || null,
      quote: (form as any).quote || null, genre: (form as any).genre || null,
      date_started: form.date_started || null,
      date_finished: form.date_finished || null,
    })
    await fetchBooks()
    setShowModal(false)
    setForm({ title: '', author: '', cover_url: '', genre: '자기계발', status: 'reading', rating: 0, notes: '', quote: '', date_started: '', date_finished: '' })
    setLoading(false)
  }

  const handleUpdateStatus = async (book: Book, status: Book['status']) => {
    const updates: Partial<Book> = { status }
    if (status === 'completed' && !book.date_finished) updates.date_finished = format(new Date(), 'yyyy-MM-dd')
    if (status === 'reading' && !book.date_started) updates.date_started = format(new Date(), 'yyyy-MM-dd')
    await supabase.from('books').update(updates).eq('id', book.id)
    setSelected(s => s ? { ...s, ...updates } : s)
    await fetchBooks()
  }

  const handleRating = async (book: Book, rating: number) => {
    await supabase.from('books').update({ rating }).eq('id', book.id)
    setSelected(s => s ? { ...s, rating } : s)
    await fetchBooks()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('books').delete().eq('id', id)
    setSelected(null)
    await fetchBooks()
  }

  const reading = books.filter(b => b.status === 'reading')
  const completed = books.filter(b => b.status === 'completed')
  const wantToRead = books.filter(b => b.status === 'want_to_read')

  const years = [...new Set(books.filter(b => b.date_finished).map(b => b.date_finished!.slice(0, 4)))].sort().reverse().map(Number)
  const currentYearBooks = completed.filter(b => b.date_finished?.startsWith(String(selectedYear))).sort((a, b) => (b.rating || 0) - (a.rating || 0))

  // Stats
  const yearCounts = years.map(y => ({ year: String(y), count: completed.filter(b => b.date_finished?.startsWith(String(y))).length }))
  const genreCounts = GENRES.map(g => ({ genre: g, count: books.filter(b => (b as any).genre === g).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count)
  const avgRating = books.filter(b => b.rating).length > 0
    ? (books.filter(b => b.rating).reduce((s, b) => s + (b.rating || 0), 0) / books.filter(b => b.rating).length).toFixed(1)
    : '-'

  const BookCover = ({ book, size = 'md' }: { book: Book; size?: 'sm' | 'md' | 'lg' }) => {
    const s = { sm: 'w-14 h-20', md: 'w-24 h-36', lg: 'w-28 h-40' }[size]
    return (book as any).cover_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={(book as any).cover_url} alt={book.title} className={`${s} object-cover rounded-lg flex-shrink-0`} />
    ) : (
      <div className={`${s} bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg flex-shrink-0 flex items-end p-1.5`}>
        <p className="text-white font-bold text-[9px] leading-tight line-clamp-4">{book.title}</p>
      </div>
    )
  }

  const StarRow = ({ rating, size = 12, onClick }: { rating?: number; size?: number; onClick?: (n: number) => void }) => (
    <div className="flex">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size}
          fill={i <= (rating || 0) ? '#F59E0B' : 'none'}
          stroke={i <= (rating || 0) ? '#F59E0B' : '#CBD5E1'}
          className={onClick ? 'cursor-pointer' : ''}
          onClick={() => onClick?.(i)} />
      ))}
    </div>
  )

  return (
    <div className="p-3 md:p-5 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📚 독서노트</h2>
          <p className="text-xs text-slate-400 mt-0.5">총 {books.length}권 · 완독 {completed.length}권</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
          <Plus size={16} /> 책 추가
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[{ k: 'all', l: '전체보기' }, { k: 'yearly', l: '연간 독서량' }, { k: 'stats', l: '통계' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.k ? 'bg-blue-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* 전체보기 */}
      {tab === 'all' && (
        <div>
          {reading.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">📖 읽는 중</h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {reading.map(book => (
                  <button key={book.id} onClick={() => setSelected(book)} className="flex-shrink-0 text-left hover:opacity-80 transition-opacity">
                    <BookCover book={book} size="lg" />
                    <p className="text-xs font-semibold text-slate-800 mt-2 w-28 truncate">{book.title}</p>
                    {book.author && <p className="text-[10px] text-slate-400 w-28 truncate">{book.author}</p>}
                    <StarRow rating={book.rating} size={11} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">✅ 완독 ({completed.length})</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {completed.map(book => (
                  <button key={book.id} onClick={() => setSelected(book)} className="text-left hover:opacity-80 transition-opacity">
                    <BookCover book={book} size="md" />
                    <p className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate">{book.title}</p>
                    <StarRow rating={book.rating} size={10} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {wantToRead.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">🔖 읽고 싶은 ({wantToRead.length})</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {wantToRead.map(book => (
                  <button key={book.id} onClick={() => setSelected(book)} className="text-left hover:opacity-80 transition-opacity">
                    <BookCover book={book} size="md" />
                    <p className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate">{book.title}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {books.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-2">📚</p>
              <p className="text-sm">첫 번째 책을 추가해보세요!</p>
            </div>
          )}
        </div>
      )}

      {/* 연간 독서량 */}
      {tab === 'yearly' && (
        <div>
          <div className="flex gap-2 flex-wrap mb-4">
            {years.length === 0 && <p className="text-sm text-slate-400">완독한 책이 없어요</p>}
            {years.map(y => (
              <button key={y} onClick={() => setSelectedYear(y)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedYear === y ? 'bg-blue-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
                {y}년 ({completed.filter(b => b.date_finished?.startsWith(String(y))).length}권)
              </button>
            ))}
          </div>
          {currentYearBooks.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">{selectedYear}년에 완독한 책이 없어요</p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
              {currentYearBooks.map((book, idx) => (
                <button key={book.id} onClick={() => setSelected(book)} className="text-left hover:opacity-80 transition-opacity">
                  {idx < 3 && (
                    <div className="text-[10px] font-bold text-amber-500 mb-0.5">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </div>
                  )}
                  <BookCover book={book} size="md" />
                  <p className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate">{book.title}</p>
                  <StarRow rating={book.rating} size={10} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 통계 */}
      {tab === 'stats' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-blue-500">{books.length}</p>
              <p className="text-xs text-slate-400 mt-1">총 등록 도서</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-green-500">{completed.length}</p>
              <p className="text-xs text-slate-400 mt-1">완독</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-amber-500">{avgRating}</p>
              <p className="text-xs text-slate-400 mt-1">평균 별점</p>
            </div>
          </div>

          {yearCounts.length > 0 && (
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">연도별 완독 권수</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={yearCounts}>
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v}권`, '완독']} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {genreCounts.length > 0 && (
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">장르별 독서 현황</h4>
              <div className="space-y-2">
                {genreCounts.slice(0, 8).map(g => (
                  <div key={g.genre} className="flex items-center gap-3">
                    <p className="text-xs text-slate-600 w-20 flex-shrink-0">{g.genre}</p>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${(g.count / books.length) * 100}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 w-6 text-right">{g.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">별점 분포</h4>
            <div className="space-y-1.5">
              {[5,4,3,2,1].map(r => {
                const cnt = books.filter(b => b.rating === r).length
                return (
                  <div key={r} className="flex items-center gap-3">
                    <StarRow rating={r} size={12} />
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="bg-amber-400 h-2 rounded-full" style={{ width: books.filter(b => b.rating).length > 0 ? `${(cnt / books.filter(b => b.rating).length) * 100}%` : '0%' }} />
                    </div>
                    <p className="text-xs text-slate-400 w-4 text-right">{cnt}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex gap-4 mb-4">
                <BookCover book={selected} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 leading-tight">{selected.title}</h3>
                      {selected.author && <p className="text-sm text-slate-400 mt-0.5">{selected.author}</p>}
                      {(selected as any).genre && <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full mt-1 inline-block">{(selected as any).genre}</span>}
                    </div>
                    <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
                  </div>
                  <div className="flex mt-2">
                    <StarRow rating={selected.rating} size={20} onClick={r => handleRating(selected, r)} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">별점을 클릭해 수정</p>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                {[{ k: 'want_to_read', l: '읽고 싶은' }, { k: 'reading', l: '읽는 중' }, { k: 'completed', l: '완독' }].map(s => (
                  <button key={s.k} onClick={() => handleUpdateStatus(selected, s.k as Book['status'])}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected.status === s.k ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                    }`}
                    style={selected.status === s.k ? { background: BOOK_STATUS_COLORS[s.k] } : {}}>
                    {s.l}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-slate-400">
                {selected.date_started && <p>시작: {selected.date_started}</p>}
                {selected.date_finished && <p>완독: {selected.date_finished}</p>}
              </div>

              {(selected as any).quote && (
                <div className="bg-amber-50 border-l-4 border-amber-300 rounded-r-lg p-3 mb-4">
                  <p className="text-xs text-amber-600 font-medium mb-1">인상 깊은 구절</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap italic">"{(selected as any).quote}"</p>
                </div>
              )}

              {selected.notes && (
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-slate-500 mb-1">메모</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              <button onClick={() => handleDelete(selected.id)}
                className="flex items-center gap-2 text-red-400 text-sm hover:text-red-600 transition-colors">
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-lg text-slate-800">책 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={22} className="text-slate-400" /></button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">책 제목 *</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="책 제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">저자</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="저자" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">장르</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
                    {GENRES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">표지 이미지 URL</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="https://..." value={form.cover_url} onChange={e => setForm(f => ({ ...f, cover_url: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">상태</label>
                  <div className="flex gap-2">
                    {[{ k: 'want_to_read', l: '읽고 싶은' }, { k: 'reading', l: '읽는 중' }, { k: 'completed', l: '완독' }].map(s => (
                      <button key={s.k} onClick={() => setForm(f => ({ ...f, status: s.k as Book['status'] }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          form.status === s.k ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                        }`}
                        style={form.status === s.k ? { background: BOOK_STATUS_COLORS[s.k] } : {}}>
                        {s.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">별점</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setForm(f => ({ ...f, rating: n }))}>
                        <Star size={26} fill={n <= form.rating ? '#F59E0B' : 'none'} stroke={n <= form.rating ? '#F59E0B' : '#CBD5E1'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">독서 시작</label>
                    <input type="date" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-blue-400"
                      value={form.date_started} onChange={e => setForm(f => ({ ...f, date_started: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">완독일</label>
                    <input type="date" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-blue-400"
                      value={form.date_finished} onChange={e => setForm(f => ({ ...f, date_finished: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">인상 깊은 구절</label>
                  <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
                    rows={8} placeholder="마음에 남는 문장을 적어보세요..."
                    value={form.quote} onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">독후감 / 메모</label>
                  <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
                    rows={6} placeholder="읽은 후 느낀 점, 배운 점..."
                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={loading || !form.title.trim()}
              className="w-full mt-4 bg-blue-500 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
