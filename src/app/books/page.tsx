'use client'

import { useEffect, useState } from 'react'
import { supabase, Book } from '@/lib/supabase'
import { BOOK_STATUS } from '@/lib/constants'
import { Plus, X, Trash2, Star } from 'lucide-react'
import { format } from 'date-fns'

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Book | null>(null)
  const [filterYear, setFilterYear] = useState(0)
  const [form, setForm] = useState({
    title: '', author: '', cover_url: '', status: 'reading' as Book['status'],
    rating: 0, notes: '', date_started: '', date_finished: ''
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
      date_started: form.date_started || null, date_finished: form.date_finished || null,
    })
    await fetchBooks()
    setShowModal(false)
    setForm({ title: '', author: '', cover_url: '', status: 'reading', rating: 0, notes: '', date_started: '', date_finished: '' })
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

  const handleDelete = async (id: string) => {
    await supabase.from('books').delete().eq('id', id)
    setSelected(null)
    await fetchBooks()
  }

  const reading = books.filter(b => b.status === 'reading')
  const years = [...new Set(books.filter(b => b.date_finished).map(b => b.date_finished!.slice(0, 4)))].sort().reverse()
  const completedByYear = filterYear
    ? books.filter(b => b.status === 'completed' && b.date_finished?.startsWith(String(filterYear)))
    : books.filter(b => b.status === 'completed')
  const wantToRead = books.filter(b => b.status === 'want_to_read')

  const StarRow = ({ rating, size = 14 }: { rating?: number; size?: number }) => (
    <div className="flex">
      {Array(5).fill(0).map((_, i) => (
        <Star key={i} size={size}
          fill={i < (rating || 0) ? '#F59E0B' : 'none'}
          stroke={i < (rating || 0) ? '#F59E0B' : '#CBD5E1'} />
      ))}
    </div>
  )

  const BookCover = ({ book, size = 'md' }: { book: Book; size?: 'sm' | 'md' | 'lg' }) => {
    const sizes = { sm: 'w-16 h-22', md: 'w-24 h-36', lg: 'w-32 h-48' }
    const textSizes = { sm: 'text-[8px]', md: 'text-[10px]', lg: 'text-xs' }
    return book.cover_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={book.cover_url} alt={book.title} className={`${sizes[size]} object-cover rounded-lg flex-shrink-0`} />
    ) : (
      <div className={`${sizes[size]} bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg flex-shrink-0 flex items-end p-1.5`}>
        <p className={`text-white font-bold leading-tight line-clamp-3 ${textSizes[size]}`}>{book.title}</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📚 독서노트</h2>
          <p className="text-xs text-slate-400 mt-0.5">총 {books.length}권 · 완독 {books.filter(b => b.status === 'completed').length}권</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
          <Plus size={16} /> 책 추가
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-blue-500">{books.filter(b => b.status === 'completed').length}</p>
          <p className="text-xs text-slate-400">완독</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{reading.length}</p>
          <p className="text-xs text-slate-400">읽는 중</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-slate-400">{wantToRead.length}</p>
          <p className="text-xs text-slate-400">읽고 싶은</p>
        </div>
      </div>

      {/* 읽는 중 */}
      {reading.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">📖 읽는 중</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {reading.map(book => (
              <button key={book.id} onClick={() => setSelected(book)}
                className="flex-shrink-0 text-left hover:opacity-80 transition-opacity">
                <BookCover book={book} size="lg" />
                <p className="text-xs font-semibold text-slate-800 mt-2 max-w-[128px] truncate">{book.title}</p>
                {book.author && <p className="text-[10px] text-slate-400 max-w-[128px] truncate">{book.author}</p>}
                <StarRow rating={book.rating} size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 완독 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-600">✅ 완독</h3>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterYear(0)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterYear === 0 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              전체 ({books.filter(b => b.status === 'completed').length})
            </button>
            {years.map(y => (
              <button key={y} onClick={() => setFilterYear(Number(y))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filterYear === Number(y) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {y}년 ({books.filter(b => b.status === 'completed' && b.date_finished?.startsWith(y)).length})
              </button>
            ))}
          </div>
        </div>
        {completedByYear.length === 0 ? (
          <p className="text-sm text-slate-400">완독한 책이 없어요</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {completedByYear.map(book => (
              <button key={book.id} onClick={() => setSelected(book)}
                className="text-left hover:opacity-80 transition-opacity">
                <BookCover book={book} size="md" />
                <p className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate">{book.title}</p>
                <StarRow rating={book.rating} size={10} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 읽고 싶은 */}
      {wantToRead.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">🔖 읽고 싶은</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {wantToRead.map(book => (
              <button key={book.id} onClick={() => setSelected(book)}
                className="text-left hover:opacity-80 transition-opacity">
                <BookCover book={book} size="md" />
                <p className="text-[11px] font-semibold text-slate-800 mt-1.5 truncate">{book.title}</p>
                {book.author && <p className="text-[10px] text-slate-400 truncate">{book.author}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex gap-4 mb-4">
              <BookCover book={selected} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 leading-tight">{selected.title}</h3>
                    {selected.author && <p className="text-sm text-slate-400 mt-0.5">{selected.author}</p>}
                  </div>
                  <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
                </div>
                <div className="flex mt-2">
                  {Array(5).fill(0).map((_, i) => (
                    <Star key={i} size={18}
                      fill={i < (selected.rating || 0) ? '#F59E0B' : 'none'}
                      stroke={i < (selected.rating || 0) ? '#F59E0B' : '#CBD5E1'}
                      className="cursor-pointer"
                      onClick={async () => {
                        const r = i + 1
                        await supabase.from('books').update({ rating: r }).eq('id', selected.id)
                        setSelected(s => s ? { ...s, rating: r } : s)
                        fetchBooks()
                      }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              {Object.entries(BOOK_STATUS).map(([key, info]) => (
                <button key={key} onClick={() => handleUpdateStatus(selected, key as Book['status'])}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected.status === key ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                  }`}
                  style={selected.status === key ? { background: info.color } : {}}>
                  {info.label}
                </button>
              ))}
            </div>

            {selected.date_started && (
              <p className="text-xs text-slate-400 mb-1">시작: {selected.date_started}</p>
            )}
            {selected.date_finished && (
              <p className="text-xs text-slate-400 mb-3">완독: {selected.date_finished}</p>
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
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">책 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="책 제목 *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="저자" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="표지 이미지 URL (선택)" value={form.cover_url} onChange={e => setForm(f => ({ ...f, cover_url: e.target.value }))} />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">상태</label>
                <div className="flex gap-2">
                  {Object.entries(BOOK_STATUS).map(([key, info]) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, status: key as Book['status'] }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.status === key ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                      }`}
                      style={form.status === key ? { background: info.color } : {}}>
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">별점</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setForm(f => ({ ...f, rating: n }))}>
                      <Star size={24} fill={n <= form.rating ? '#F59E0B' : 'none'} stroke={n <= form.rating ? '#F59E0B' : '#CBD5E1'} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">독서 시작</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                    value={form.date_started} onChange={e => setForm(f => ({ ...f, date_started: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">완독일</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                    value={form.date_finished} onChange={e => setForm(f => ({ ...f, date_finished: e.target.value }))} />
                </div>
              </div>
              <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                rows={4} placeholder="메모, 인상 깊은 구절..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <button onClick={handleSave} disabled={loading || !form.title.trim()}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
