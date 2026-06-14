'use client'

import { useEffect, useState } from 'react'
import { supabase, ArchiveItem } from '@/lib/supabase'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, X, Trash2, FolderOpen, ExternalLink } from 'lucide-react'

const CATEGORIES = ['증명서류', '사진', '기록증/수료증', '건강', '재정', '기타']

export default function ArchivePage() {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [selected, setSelected] = useState<ArchiveItem | null>(null)
  const [filterCat, setFilterCat] = useState('전체')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', category: '기타', file_url: '', note: '' })

  const fetchItems = async () => {
    const { data } = await supabase.from('archive_items').select('*').order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => { fetchItems() }, [])

  const handleSave = async () => {
    if (!form.title.trim()) return
    await supabase.from('archive_items').insert({
      title: form.title,
      category: form.category,
      file_url: form.file_url || null,
      note: form.note || null,
    })
    setForm({ title: '', category: '기타', file_url: '', note: '' })
    setShowModal(false)
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('archive_items').delete().eq('id', id)
    setSelected(null)
    fetchItems()
  }

  const cats = ['전체', ...CATEGORIES]
  const displayed = filterCat === '전체' ? items : items.filter(i => i.category === filterCat)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📁 자료실</h2>
          <p className="text-xs text-slate-400 mt-0.5">증명사진, 기록증, 중요 자료 보관</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-teal-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-600 transition-colors">
          <Plus size={16} /> 추가
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4 mt-4">
        {cats.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterCat === c ? 'bg-teal-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FolderOpen size={48} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm">자료를 추가해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {displayed.map(item => (
            <button key={item.id} onClick={() => setSelected(item)}
              className="card p-4 text-left hover:shadow-md transition-shadow">
              <div className="text-2xl mb-2">📄</div>
              <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
              {item.category && (
                <span className="text-[10px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full mt-1 inline-block">{item.category}</span>
              )}
              <p className="text-[10px] text-slate-400 mt-1.5">
                {format(new Date(item.created_at), 'yyyy.M.d', { locale: ko })}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800">{selected.title}</h3>
                {selected.category && <p className="text-xs text-slate-400 mt-0.5">{selected.category}</p>}
              </div>
              <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            {selected.file_url && (
              <a href={selected.file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-500 hover:underline mb-3">
                <ExternalLink size={14} /> 링크 열기
              </a>
            )}
            {selected.note && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.note}</p>
              </div>
            )}
            <p className="text-xs text-slate-400 mb-4">
              {format(new Date(selected.created_at), 'yyyy년 M월 d일', { locale: ko })}
            </p>
            <button onClick={() => handleDelete(selected.id)}
              className="flex items-center gap-2 text-red-400 text-sm hover:text-red-600 transition-colors">
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">자료 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                placeholder="제목" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">분류</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">링크 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                  placeholder="https://..." value={form.file_url}
                  onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 resize-none"
                  rows={3} placeholder="간단한 메모..."
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <button onClick={handleSave} disabled={!form.title.trim()}
                className="w-full bg-teal-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-50 transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
