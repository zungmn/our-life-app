'use client'

import { useEffect, useState } from 'react'
import { supabase, Account } from '@/lib/supabase'
import { Plus, X, Trash2, Search, Copy, ExternalLink, KeyRound } from 'lucide-react'

const EMPTY = { site: '', category: '', username: '', password: '', extra_password: '', url: '', note: '' }

export default function AccountsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [query, setQuery] = useState('')
  const [filterCat, setFilterCat] = useState('전체')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Account | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').order('site', { ascending: true })
    setAccounts(data || [])
  }
  useEffect(() => { fetchAccounts() }, [])

  const cats = ['전체', ...Array.from(new Set(accounts.map(a => a.category).filter(Boolean) as string[]))]
  const filtered = accounts.filter(a => {
    if (filterCat !== '전체' && a.category !== filterCat) return false
    if (!query) return true
    const q = query.toLowerCase()
    return [a.site, a.username, a.category, a.note, a.url].some(v => (v || '').toLowerCase().includes(q))
  })

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowModal(true) }
  const openEdit = (a: Account) => {
    setEditItem(a)
    setForm({ site: a.site, category: a.category || '', username: a.username || '', password: a.password || '', extra_password: a.extra_password || '', url: a.url || '', note: a.note || '' })
    setShowModal(true)
  }
  const handleSave = async () => {
    if (!form.site.trim()) return
    setLoading(true)
    const payload = {
      site: form.site, category: form.category || null, username: form.username || null,
      password: form.password || null, extra_password: form.extra_password || null,
      url: form.url || null, note: form.note || null,
    }
    const res = editItem
      ? await supabase.from('accounts').update(payload).eq('id', editItem.id)
      : await supabase.from('accounts').insert(payload)
    if (res.error) { alert('저장 실패: ' + res.error.message); setLoading(false); return }
    await fetchAccounts()
    setShowModal(false); setEditItem(null); setForm(EMPTY); setLoading(false)
  }
  const handleDelete = async () => {
    if (!editItem || !confirm('이 계정을 삭제할까요?')) return
    await supabase.from('accounts').delete().eq('id', editItem.id)
    await fetchAccounts()
    setShowModal(false); setEditItem(null)
  }
  const copy = (t?: string) => { if (t) { navigator.clipboard.writeText(t) } }

  const catColor = (c?: string) => c === '치과' ? 'bg-blue-50 text-blue-600' : c === '은행/카드' ? 'bg-rose-50 text-rose-600' : c === '여행' ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'

  return (
    <div className={embedded ? 'max-w-full' : 'p-6 md:p-10 max-w-full'}>
      <div className="flex items-center justify-between mb-4">
        <div>
          {!embedded && <h2 className="text-2xl font-bold text-slate-800">🔐 계정</h2>}
          <p className="text-xs text-slate-400 mt-0.5">총 {accounts.length}개</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors">
          <Plus size={16} /> 추가
        </button>
      </div>

      {/* 검색 */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="사이트/아이디/메모 검색"
          className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
      </div>
      {/* 구분 필터 */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {cats.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === c ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
            {c}{c !== '전체' && ` (${accounts.filter(a => a.category === c).length})`}
          </button>
        ))}
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <KeyRound size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm mb-3">계정이 없습니다.</p>
          <button onClick={async () => {
            if (!confirm('노션에서 가져온 계정을 불러올까요?')) return
            const r = await fetch('/api/import-accounts', { method: 'POST' }); const j = await r.json()
            alert(j.message || j.error || '완료'); fetchAccounts()
          }} className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">노션 데이터 불러오기</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {filtered.map(a => (
            <div key={a.id} onDoubleClick={() => openEdit(a)} className="card p-2.5 group cursor-pointer">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="font-semibold text-slate-800 text-sm truncate">{a.site}</p>
                {a.category && <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${catColor(a.category)}`}>{a.category}</span>}
                <div className="flex-1" />
                {a.url && <a href={a.url.startsWith('http') ? a.url : `https://${a.url}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-300 hover:text-blue-500"><ExternalLink size={13} /></a>}
                <button onClick={() => openEdit(a)} className="text-slate-300 hover:text-blue-500 transition-colors">✏️</button>
              </div>
              <div className="flex items-center gap-1 text-xs min-w-0">
                <span className="text-slate-400 flex-shrink-0">ID</span>
                <span className="text-slate-700 truncate">{a.username || '-'}</span>
                {a.username && <button onClick={e => { e.stopPropagation(); copy(a.username) }} className="text-slate-300 hover:text-slate-600 flex-shrink-0"><Copy size={10} /></button>}
                <span className="text-slate-400 flex-shrink-0 ml-2">PW</span>
                <span className="text-slate-700 truncate font-mono">{a.password || '-'}</span>
                {a.password && <button onClick={e => { e.stopPropagation(); copy(a.password) }} className="text-slate-300 hover:text-slate-600 flex-shrink-0"><Copy size={10} /></button>}
                {a.extra_password && <><span className="text-slate-400 flex-shrink-0 ml-2">+</span><span className="text-slate-700 truncate font-mono">{a.extra_password}</span></>}
              </div>
              {a.note && <p className="text-[11px] text-slate-400 truncate mt-0.5">📝 {a.note}</p>}
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-sm text-slate-400 text-center py-8">검색 결과가 없어요</p>}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editItem ? '계정 수정' : '계정 추가'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">사이트 *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">구분</label>
                  <input list="acct-cats" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="치과/은행·카드/여행" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                  <datalist id="acct-cats">{cats.filter(c => c !== '전체').map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">URL</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="https://..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">아이디</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">비밀번호</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">추가 비밀번호 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={form.extra_password} onChange={e => setForm(f => ({ ...f, extra_password: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">비고</label>
                <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              {editItem && (
                <button onClick={handleDelete} className="w-full border border-red-200 text-red-400 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1"><Trash2 size={14} /> 삭제</button>
              )}
              <button onClick={handleSave} disabled={loading || !form.site.trim()}
                className="w-full bg-slate-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                {loading ? '저장 중...' : editItem ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
