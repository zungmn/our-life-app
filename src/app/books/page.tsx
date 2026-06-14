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
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [form, setForm] = useState({
    title: '', author: '', status: 'reading' as Book['status'],
    rating: 0, notes: '', date_started: '', date_finished: ''
  })
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false })
    setBooks(data || [])
  }

  useEffect(() => { fetch() }, [])

  const handleSave = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    await supabase.from('books').insert({
      title: form.title,
      author: form.author || null,
      status: form.status,
      rating: form.rating || null,
      notes: form.notes || null,
      date_started: form.date_started || null,
      date_finished: form.date_finished || null,
    })
    await fetch()
    setShowModal(false)
    setForm({ title: '', author: '', status: 'reading', rating: 0, notes: '', date_started: '', date_finished: '' })
    setLoading(false)
  }

  const handleUpdateStatus = async (book: Book, status: Book['status']) => {
    await supabase.from('books').update({ status }).eq('id', book.id)
    await fetch()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('books').delete().eq('id', id)
    setSelected(null)
    await fetch()
  }

  const displayed = filterStatus === 'all' ? books : books.filter(b => b.status === filterStatus)

  const counts = {
    all: books.length,
    want_to_read: books.filter(b => b.status === 'want_to_read').length,
    reading: books.filter(b => b.status === 'reading').length,
    completed: books.filter(b => b.status === 'completed').length,
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-slate-800">📚 독서노트</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
          <Plus size={16} /> 책 추가
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { key: 'all', label: '전체' },
          { key: 'completed', label: '완독' },
          { key: 'reading', label: '읽는 중' },
          { key: 'want_to_read', label: '읽고 싶은' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`card p-3 text-center transition-all ${filterStatus === key ? 'ring-2 ring-blue-400' : ''}`}
          >
            <p className="text-lg font-bold text-slate-800">{counts[key as keyof typeof counts]}</p>
            <p className="text-[10px] text-slate-400">{label}</p>
          </button>
        ))}
      </div>

      {/* Book grid */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">📖</p>
          <p className="text-sm">책을 추가해보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {displayed.map(book => {
            const statusInfo = BOOK_STATUS[book.status]
            return (
              <button key={book.id} onClick={() => setSelected(book)}
                className="card p-4 text-left hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">📕</div>
                <p className="text-sm font-semibold text-slate-800 leading-tight mb-1">{book.title}</p>
                {book.author && <p className="text-xs text-slate-400 mb-2">{book.author}</p>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium`}
                  style={{ background: statusInfo.color + '20', color: statusInfo.color }}>
                  {statusInfo.label}
                </span>
                {book.rating ? (
                  <div className="flex mt-1.5">
                    {Array(5).fill(0).map((_, i) => (
                      <Star key={i} size={10} fill={i < book.rating! ? '#F59E0B' : 'none'} stroke={i < book.rating! ? '#F59E0B' : '#CBD5E1'} />
                    ))}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {/* Book detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800">{selected.title}</h3>
                {selected.author && <p className="text-sm text-slate-400">{selected.author}</p>}
              </div>
              <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
            </div>

            {/* Status buttons */}
            <div className="flex gap-2 mb-4">
              {Object.entries(BOOK_STATUS).map(([key, info]) => (
                <button key={key}
                  onClick={() => handleUpdateStatus(selected, key as Book['status'])}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected.status === key ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                  }`}
                  style={selected.status === key ? { background: info.color } : {}}
                >
                  {info.label}
                </button>
              ))}
            </div>

            {selected.notes && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-500 mb-1">메모</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}

            {selected.rating && (
              <div className="flex gap-1 mb-4">
                {Array(5).fill(0).map((_, i) => (
                  <Star key={i} size={20} fill={i < selected.rating! ? '#F59E0B' : 'none'} stroke={i < selected.rating! ? '#F59E0B' : '#CBD5E1'} />
                ))}
              </div>
            )}

            <button onClick={() => handleDelete(selected.id)}
              className="flex items-center gap-2 text-red-400 text-sm hover:text-red-600 transition-colors">
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>
      )}

      {/* Add book modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">책 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">책 제목 *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="책 제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">저자</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="저자" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">상태</label>
                <div className="flex gap-2">
                  {Object.entries(BOOK_STATUS).map(([key, info]) => (
                    <button key={key}
                      onClick={() => setForm(f => ({ ...f, status: key as Book['status'] }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.status === key ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                      }`}
                      style={form.status === key ? { background: info.color } : {}}
                    >
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
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모/독서 노트</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                  rows={4} placeholder="인상 깊은 구절, 느낀 점..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
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
