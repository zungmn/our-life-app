'use client'

import { useEffect, useState } from 'react'
import { supabase, LifeNote } from '@/lib/supabase'
import { Plus, X, Trash2, Lock, Star, BookMarked } from 'lucide-react'
import DateInput from '@/components/DateInput'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function LifeNotesPage() {
  const [notes, setNotes] = useState<LifeNote[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<LifeNote | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'record' | 'advice'>('all')
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    content: '',
    type: 'advice' as 'record' | 'advice',
    source: '',
  })
  const [loading, setLoading] = useState(false)

  const fetchNotes = async () => {
    const { data } = await supabase.from('life_notes').select('*').order('date', { ascending: false })
    setNotes(data || [])
  }

  useEffect(() => { fetchNotes() }, [])

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setLoading(true)
    await supabase.from('life_notes').insert({
      date: form.date,
      title: form.title,
      content: form.content,
      type: form.type,
      source: form.source || null,
    })
    await fetchNotes()
    setShowModal(false)
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), title: '', content: '', type: 'advice', source: '' })
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('life_notes').delete().eq('id', id)
    setSelected(null)
    await fetchNotes()
  }

  const displayed = filterType === 'all' ? notes : notes.filter(n => n.type === filterType)

  const typeInfo = {
    advice: { label: '중요', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    record: { label: '기록', icon: BookMarked, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">⭐ 기록</h2>
          <div className="flex items-center gap-1 mt-0.5">
            <Lock size={11} className="text-slate-400" />
            <p className="text-xs text-slate-400">나만의 비공개 기록</p>
          </div>
        </div>
        <button onClick={() => { setForm({ date: format(new Date(), 'yyyy-MM-dd'), title: '', content: '', type: 'advice', source: '' }); setShowModal(true) }}
          className="flex items-center gap-1 bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
          <Plus size={16} /> 기록
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-5">유튜브, 책에서 얻은 좋은 말들과 나의 인생 기록 ✨</p>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'all', label: '전체' },
          { key: 'advice', label: '중요' },
          { key: 'record', label: '기록' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setFilterType(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === key ? 'bg-yellow-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">⭐</p>
          <p className="text-sm">좋은 말, 소중한 기억을 기록해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(note => {
            const ti = typeInfo[note.type]
            const Icon = ti.icon
            return (
              <button key={note.id} onClick={() => setSelected(note)}
                className="card p-4 text-left w-full hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ti.bg}`}>
                    <Icon size={16} className={ti.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{note.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${ti.bg} ${ti.color}`}>
                        {ti.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-[10px] text-slate-400">
                        {format(new Date(note.date), 'M월 d일', { locale: ko })}
                      </p>
                      {note.source && <p className="text-[10px] text-slate-300">· {note.source}</p>}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block mb-1 ${typeInfo[selected.type].bg} ${typeInfo[selected.type].color}`}>
                  {typeInfo[selected.type].label}
                </div>
                <h3 className="font-bold text-slate-800">{selected.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(selected.date), 'yyyy년 M월 d일', { locale: ko })}
                  {selected.source && ` · ${selected.source}`}
                </p>
              </div>
              <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className={`rounded-xl p-4 mb-4 ${typeInfo[selected.type].bg}`}>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selected.content}</p>
            </div>
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
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">인생기록 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              {/* Type */}
              <div className="flex gap-2">
                {(['advice', 'record'] as const).map(type => {
                  const ti = typeInfo[type]
                  return (
                    <button key={type}
                      onClick={() => setForm(f => ({ ...f, type }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.type === type ? `${ti.bg} ${ti.color} ${ti.border}` : 'border-slate-200 text-slate-500'
                      }`}>
                      {ti.label}
                    </button>
                  )
                })}
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <DateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">제목 *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                  placeholder="제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">내용 *</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 resize-none"
                  rows={15} placeholder="좋은 말이나 기록하고 싶은 내용..."
                  value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">출처 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                  placeholder="유튜브 채널, 책 제목 등..."
                  value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
              </div>
              <button onClick={handleSave} disabled={loading || !form.title.trim() || !form.content.trim()}
                className="w-full bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50">
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
