'use client'

import { useEffect, useState } from 'react'
import { supabase, JournalEntry } from '@/lib/supabase'
import { MOODS } from '@/lib/constants'
import { Plus, X, Trash2, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<JournalEntry | null>(null)
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), content: '', mood: 'good' })
  const [loading, setLoading] = useState(false)

  const fetchEntries = async () => {
    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })
    setEntries(data || [])
  }

  useEffect(() => { fetchEntries() }, [])

  const handleSave = async () => {
    if (!form.content.trim()) return
    setLoading(true)
    await supabase.from('journal_entries').insert({
      date: form.date,
      content: form.content,
      mood: form.mood,
    })
    await fetchEntries()
    setShowModal(false)
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), content: '', mood: 'good' })
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('journal_entries').delete().eq('id', id)
    setSelected(null)
    await fetchEntries()
  }

  const moodEmoji = (mood: string) => MOODS.find(m => m.value === mood)?.label.split(' ')[0] || '😊'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📔 감사 일기</h2>
          <div className="flex items-center gap-1 mt-0.5">
            <Lock size={11} className="text-slate-400" />
            <p className="text-xs text-slate-400">나만의 비공개 기록</p>
          </div>
        </div>
        <button onClick={() => { setForm({ date: format(new Date(), 'yyyy-MM-dd'), content: '', mood: 'good' }); setShowModal(true) }}
          className="flex items-center gap-1 bg-purple-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors">
          <Plus size={16} /> 쓰기
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-5">오늘 감사한 일, 좋았던 일들을 기록해보세요 ✨</p>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">📔</p>
          <p className="text-sm">오늘의 감사함을 기록해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <button key={entry.id} onClick={() => setSelected(entry)}
              className="card p-4 text-left w-full hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{moodEmoji(entry.mood || 'good')}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {format(new Date(entry.date), 'M월 d일 (EEEE)', { locale: ko })}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap text-left">{entry.content}</p>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{moodEmoji(selected.mood || 'good')}</span>
                <p className="font-medium text-slate-800">
                  {format(new Date(selected.date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                </p>
              </div>
              <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selected.content}</p>
            </div>
            <button onClick={() => handleDelete(selected.id)}
              className="flex items-center gap-2 text-red-400 text-sm hover:text-red-600 transition-colors">
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>
      )}

      {/* Write modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">감사 일기 쓰기</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">오늘의 기분</label>
                <div className="grid grid-cols-4 gap-2">
                  {MOODS.map(m => (
                    <button key={m.value}
                      onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                      className={`py-2 rounded-lg text-center text-sm border transition-colors ${
                        form.mood === m.value ? 'bg-purple-50 border-purple-300' : 'border-slate-200'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">오늘 감사한 것들</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 resize-none"
                  rows={6}
                  placeholder="오늘 감사했던 것들을 자유롭게 써보세요..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  autoFocus
                />
              </div>
              <button onClick={handleSave} disabled={loading || !form.content.trim()}
                className="w-full bg-purple-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50">
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
