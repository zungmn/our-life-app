'use client'

import { useEffect, useState } from 'react'
import { supabase, ArchiveItem, WeddingGift } from '@/lib/supabase'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, X, Trash2, FolderOpen, ExternalLink, Paperclip, Download } from 'lucide-react'
import DatePickerInput from '@/components/DatePickerInput'
import AccountsPage from '@/app/accounts/page'

const CATEGORIES = ['사진기록', '치과 면허증', '마라톤', '청첩장', '계정']
const TODAY = format(new Date(), 'yyyy-MM-dd')
const EMPTY_FORM = { title: '', category: '사진기록', file_url: '', note: '', item_date: TODAY, photos: [] as string[], purpose: '', distance: '', record_time: '' }
// 마라톤 페이스 계산 (기록 "51:30" 또는 "1:45:20", 거리 km → min/km)
function calcPace(recordTime: string, distanceKm: number): string {
  if (!recordTime || !distanceKm) return ''
  const parts = recordTime.split(':').map(p => parseInt(p, 10))
  if (parts.some(isNaN)) return ''
  let totalSec = 0
  if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2]
  else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1]
  else return ''
  const perKm = totalSec / distanceKm
  const m = Math.floor(perKm / 60), s = Math.round(perKm % 60)
  return `${m}'${String(s).padStart(2, '0')}"/km`
}

export default function ArchivePage() {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [selected, setSelected] = useState<ArchiveItem | null>(null)
  const [filterCat, setFilterCat] = useState('사진기록')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<ArchiveItem | null>(null)
  const [uploading, setUploading] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [inviteYear, setInviteYear] = useState(new Date().getFullYear() - 1) // 기본: 작년
  const [downloading, setDownloading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // 축의금
  const [gifts, setGifts] = useState<WeddingGift[]>([])
  const [giftQuery, setGiftQuery] = useState('')
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [editGift, setEditGift] = useState<WeddingGift | null>(null)
  const [giftForm, setGiftForm] = useState({ name: '', amount: '', date: '', method: '', note: '' })

  const fetchGifts = async () => {
    const { data } = await supabase.from('wedding_gifts').select('*').order('name', { ascending: true })
    setGifts(data || [])
  }
  useEffect(() => { if (filterCat === '청첩장') fetchGifts() }, [filterCat])

  const openAddGift = () => { setEditGift(null); setGiftForm({ name: '', amount: '', date: '', method: '', note: '' }); setShowGiftModal(true) }
  const openEditGift = (g: WeddingGift) => {
    setEditGift(g)
    setGiftForm({ name: g.name, amount: g.amount ? g.amount.toLocaleString() : '', date: g.date || '', method: g.method || '', note: g.note || '' })
    setShowGiftModal(true)
  }
  const saveGift = async () => {
    if (!giftForm.name.trim()) return
    const payload = { name: giftForm.name, amount: parseInt(giftForm.amount.replace(/[^0-9]/g, '') || '0', 10), date: giftForm.date || null, method: giftForm.method || null, note: giftForm.note || null }
    const res = editGift
      ? await supabase.from('wedding_gifts').update(payload).eq('id', editGift.id)
      : await supabase.from('wedding_gifts').insert(payload)
    if (res.error) { alert('저장 실패: ' + res.error.message); return }
    await fetchGifts(); setShowGiftModal(false); setEditGift(null)
  }
  const deleteGift = async () => {
    if (!editGift || !confirm('삭제할까요?')) return
    await supabase.from('wedding_gifts').delete().eq('id', editGift.id)
    await fetchGifts(); setShowGiftModal(false); setEditGift(null)
  }
  const giftMatches = giftQuery.trim() ? gifts.filter(g => g.name.includes(giftQuery.trim())) : []

  const fetchItems = async () => {
    const { data } = await supabase.from('archive_items').select('*').order('item_date', { ascending: false, nullsFirst: false })
    setItems(data || [])
  }

  useEffect(() => { fetchItems() }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('archive').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('archive').getPublicUrl(path)
      setForm(f => ({ ...f, file_url: data.publicUrl }))
    } catch {
      alert('파일 업로드 실패. Supabase Storage "archive" 버킷을 먼저 만들어주세요.')
    }
    setUploading(false)
  }

  // 여러 장 사진 업로드
  const handlePhotos = async (files: FileList) => {
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split('.').pop()
        const path = `archive_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error } = await supabase.storage.from('archive').upload(path, file)
        if (error) throw error
        urls.push(supabase.storage.from('archive').getPublicUrl(path).data.publicUrl)
      } catch { alert('업로드 실패 (archive 버킷 확인)') }
    }
    setForm(f => ({ ...f, photos: [...f.photos, ...urls] }))
    setUploading(false)
  }
  const downloadPhoto = async (url: string) => {
    try { const r = await fetch(url); const b = await r.blob(); const o = URL.createObjectURL(b); const a = document.createElement('a'); a.href = o; a.download = url.split('/').pop()?.split('?')[0] || 'photo'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(o) } catch { window.open(url, '_blank') }
  }

  const openAdd = () => { setEditItem(null); setForm({ ...EMPTY_FORM, category: filterCat === '계정' ? '사진기록' : filterCat, item_date: TODAY }); setShowModal(true) }
  const openEdit = (it: ArchiveItem) => {
    setSelected(null); setEditItem(it)
    setForm({ title: it.title, category: it.category || '사진기록', file_url: it.file_url || '', note: it.note || '', item_date: it.item_date || TODAY, photos: it.photos || [], purpose: it.purpose || '', distance: it.distance ? String(it.distance) : '', record_time: it.record_time || '' })
    setShowModal(true)
  }
  const handleSave = async () => {
    if (!form.title.trim()) return
    const payload = {
      title: form.title, category: form.category, file_url: form.file_url || null,
      note: form.note || null, item_date: form.item_date || null,
      photos: form.photos, purpose: form.purpose || null,
      distance: form.distance ? parseFloat(form.distance) : null, record_time: form.record_time || null,
    }
    const res = editItem
      ? await supabase.from('archive_items').update(payload).eq('id', editItem.id)
      : await supabase.from('archive_items').insert(payload)
    if (res.error) { alert('저장 실패: ' + res.error.message); return }
    setForm(EMPTY_FORM); setShowModal(false); setEditItem(null); fetchItems()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('archive_items').delete().eq('id', id)
    setSelected(null)
    fetchItems()
  }

  const cats = CATEGORIES
  const displayed = items.filter(i => i.category === filterCat)
  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(url)

  // 청첩장 연도 선택지
  const inviteYears = [...new Set(items.filter(i => i.category === '청첩장' && (i as any).item_date).map(i => new Date((i as any).item_date).getFullYear()))].sort((a, b) => b - a)

  // 청첩장 일괄 다운로드 (파일명 mmdd, 같은 날 여러 개면 mmdd(1), (2)...)
  const handleDownloadInvites = async () => {
    const list = items
      .filter(i => i.category === '청첩장' && i.item_date && new Date(i.item_date).getFullYear() === inviteYear)
      .sort((a, b) => String(a.item_date).localeCompare(String(b.item_date)))
    // 날짜별로 사진(파일 + 여러 장) 모으기
    const byDate: Record<string, string[]> = {}
    for (const it of list) {
      const d = new Date(it.item_date!)
      const mmdd = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
      const urls = [it.file_url, ...(it.photos || [])].filter(Boolean) as string[]
      byDate[mmdd] = (byDate[mmdd] || []).concat(urls)
    }
    const total = Object.values(byDate).reduce((s, a) => s + a.length, 0)
    if (total === 0) { alert(`${inviteYear}년 청첩장 사진이 없어요`); return }
    setDownloading(true)
    for (const mmdd of Object.keys(byDate)) {
      const arr = byDate[mmdd]
      for (let idx = 0; idx < arr.length; idx++) {
        const url = arr[idx]
        const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase()
        const name = arr.length > 1 ? `${mmdd}(${idx + 1}).${ext}` : `${mmdd}.${ext}`
        try {
          const res = await fetch(url)
          const blob = await res.blob()
          const objUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = objUrl; a.download = name
          document.body.appendChild(a); a.click(); a.remove()
          URL.revokeObjectURL(objUrl)
          await new Promise(r => setTimeout(r, 300))
        } catch {
          // 실패 시 새 탭으로라도 열기
          window.open(url, '_blank')
        }
      }
    }
    setDownloading(false)
  }

  return (
    <div className="p-6 md:p-10 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📁 자료실</h2>
          <p className="text-xs text-slate-400 mt-0.5">증명사진, 기록증, 중요 자료 보관</p>
        </div>
        {filterCat !== '계정' && (
          <button onClick={openAdd}
            className="flex items-center gap-1 bg-teal-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-600 transition-colors">
            <Plus size={16} /> 추가
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {cats.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === c ? 'bg-teal-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* 청첩장: 연도별 일괄 다운로드 */}
      {filterCat === '청첩장' && (
        <div className="card p-3 mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-600 flex-1">청첩장 일괄 다운로드 (파일명: 월일 mmdd)</span>
          <select value={inviteYear} onChange={e => setInviteYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-400">
            {(inviteYears.length ? inviteYears : [inviteYear]).map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button onClick={handleDownloadInvites} disabled={downloading}
            className="flex items-center gap-1 bg-teal-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-teal-600 disabled:opacity-50 transition-colors">
            <Download size={15} /> {downloading ? '다운로드 중...' : '다운로드'}
          </button>
        </div>
      )}

      {/* 청첩장 → 축의금 조회/기록 */}
      {filterCat === '청첩장' && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800 text-sm">💰 축의금 조회 (내가 받은 내역)</h3>
            <button onClick={openAddGift} className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition-colors">+ 축의금 추가</button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">청첩장을 준 사람 이름을 입력하면, 그 사람이 예전에 나에게 준 축의금을 찾아줍니다.</p>
          <input value={giftQuery} onChange={e => setGiftQuery(e.target.value)} placeholder="이름 검색 (예: 손기진)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400 mb-2" />
          {gifts.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-xs text-slate-400 mb-2">축의금 데이터가 없습니다.</p>
              <button onClick={async () => { if (!confirm('노션 축의금 목록을 불러올까요?')) return; const r = await fetch('/api/import-gifts', { method: 'POST' }); const j = await r.json(); alert(j.message || j.error || '완료'); fetchGifts() }}
                className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">노션 데이터 불러오기</button>
            </div>
          ) : giftQuery.trim() === '' ? (
            <p className="text-xs text-slate-400">이름을 입력하면 검색됩니다. (총 {gifts.length}건 · 합계 {gifts.reduce((s, g) => s + (g.amount || 0), 0).toLocaleString()}원)</p>
          ) : giftMatches.length === 0 ? (
            <p className="text-xs text-slate-400">&apos;{giftQuery}&apos; 님이 준 축의금 기록이 없어요.</p>
          ) : (
            <div className="space-y-1">
              {giftMatches.map(g => (
                <div key={g.id} onDoubleClick={() => openEditGift(g)} className="flex items-center gap-2 text-sm bg-rose-50 rounded-lg px-3 py-2 cursor-pointer">
                  <span className="font-medium text-slate-800 flex-1">{g.name}</span>
                  {g.method && <span className="text-[10px] text-slate-400">{g.method}</span>}
                  {g.date && <span className="text-[10px] text-slate-400">{g.date}</span>}
                  <span className="font-bold text-rose-600">{(g.amount || 0).toLocaleString()}원</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {filterCat === '계정' && <AccountsPage embedded />}

      {filterCat !== '계정' && (displayed.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FolderOpen size={48} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm">자료를 추가해보세요</p>
        </div>
      ) : filterCat === '청첩장' ? (
        // 청첩장: 이름 + 날짜만 (사진 X)
        <div className="space-y-1.5">
          {displayed.map(item => (
            <div key={item.id} onDoubleClick={() => openEdit(item)} onClick={() => setSelected(item)}
              className="card px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
              <span className="font-semibold text-slate-800 text-sm flex-1 truncate">{item.title}</span>
              {((item.photos?.length || 0) + (item.file_url ? 1 : 0)) > 0 && <span className="text-[10px] text-teal-500">📎 {(item.photos?.length || 0) + (item.file_url ? 1 : 0)}</span>}
              <span className="text-xs text-slate-400">{item.item_date ? format(new Date(item.item_date), 'yyyy.M.d') : ''}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {displayed.map(item => {
            const thumb = (item.photos && item.photos[0]) || item.file_url
            const pace = item.category === '마라톤' && item.record_time && item.distance ? calcPace(item.record_time, Number(item.distance)) : ''
            return (
              <button key={item.id} onClick={() => setSelected(item)} onDoubleClick={() => openEdit(item)} className="card p-3 text-left hover:shadow-md transition-shadow">
                {thumb && isImage(thumb) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={item.title} loading="lazy" className="w-full aspect-[2/3] object-cover rounded-lg mb-2" />
                ) : (
                  <div className="w-full aspect-[2/3] bg-teal-50 rounded-lg flex items-center justify-center mb-2">
                    {thumb ? <Paperclip size={24} className="text-teal-300" /> : <FolderOpen size={24} className="text-teal-300" />}
                  </div>
                )}
                <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                {item.purpose && <span className="text-[10px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full mt-1 inline-block">{item.purpose}</span>}
                {pace && <p className="text-[10px] text-orange-500 mt-0.5">{item.distance}km · {pace}</p>}
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {item.item_date ? format(new Date(item.item_date), 'yyyy.M.d') : format(new Date(item.created_at), 'yyyy.M.d')}
                </p>
              </button>
            )
          })}
        </div>
      ))}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800">{selected.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selected.category}{selected.purpose ? ` · ${selected.purpose}` : ''}
                  {selected.item_date ? ` · ${format(new Date(selected.item_date), 'yyyy년 M월 d일', { locale: ko })}` : ''}
                </p>
                {selected.category === '마라톤' && selected.distance && (
                  <p className="text-xs text-orange-500 mt-0.5">🏃 {selected.distance}km · 기록 {selected.record_time || '-'} · 페이스 {selected.record_time && selected.distance ? calcPace(selected.record_time, Number(selected.distance)) : '-'}</p>
                )}
              </div>
              <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            {/* 완주기록증 / 대표 파일 */}
            {selected.file_url && (isImage(selected.file_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.file_url} alt="" onClick={() => setLightbox(selected.file_url!)} className="w-full rounded-lg mb-2 max-h-72 object-contain bg-slate-50 cursor-pointer" />
            ) : (
              <a href={selected.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline mb-2"><ExternalLink size={14} /> 파일 열기</a>
            ))}
            {/* 사진들 */}
            {selected.photos && selected.photos.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {selected.photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" onClick={() => setLightbox(url)} className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80" />
                ))}
              </div>
            )}
            {selected.note && <div className="bg-slate-50 rounded-lg p-3 mb-4"><p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.note}</p></div>}
            <div className="flex items-center gap-4">
              <button onClick={() => openEdit(selected)} className="text-blue-500 text-sm hover:text-blue-700 transition-colors">✏️ 수정</button>
              <button onClick={() => handleDelete(selected.id)} className="flex items-center gap-1 text-red-400 text-sm hover:text-red-600 transition-colors"><Trash2 size={14} /> 삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editItem ? '자료 수정' : '자료 추가'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{form.category === '청첩장' ? '이름(신랑/신부) *' : '제목 *'}</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                  placeholder={form.category === '청첩장' ? '예: 홍길동' : '예: 2024년 증명사진'} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <label className="text-xs text-slate-500 mb-1 block">분류</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                    placeholder="선택" value={form.category}
                    onFocus={() => setCatOpen(true)}
                    onChange={e => { setCatOpen(true); setForm(f => ({ ...f, category: e.target.value })) }} />
                  {catOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCatOpen(false)} />
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {CATEGORIES.filter(c => c !== '계정').map(c => (
                          <button key={c} type="button" onClick={() => { setForm(f => ({ ...f, category: c })); setCatOpen(false) }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 transition-colors ${form.category === c ? 'text-teal-600 font-medium' : 'text-slate-700'}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                  <DatePickerInput value={form.item_date} onChange={v => setForm(f => ({ ...f, item_date: v }))} className="w-full" />
                </div>
              </div>

              {/* 사진기록: 용도 */}
              {form.category === '사진기록' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">용도</label>
                  <input list="purpose-list" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                    placeholder="예: 증명사진 / 프로필 / 여권 / 졸업사진" value={form.purpose}
                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
                  <datalist id="purpose-list"><option value="증명사진" /><option value="프로필" /><option value="여권" /><option value="졸업사진" /></datalist>
                </div>
              )}

              {/* 마라톤: 거리/기록/페이스 */}
              {form.category === '마라톤' && (
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">거리 (km)</label>
                    <input inputMode="decimal" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                      placeholder="예: 10 / 21.1" value={form.distance} onChange={e => setForm(f => ({ ...f, distance: e.target.value.replace(/[^0-9.]/g, '') }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">기록 (시:분:초)</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                      placeholder="예: 52:30 / 1:45:20" value={form.record_time} onChange={e => setForm(f => ({ ...f, record_time: e.target.value }))} />
                  </div>
                  <div className="text-center pb-2">
                    <p className="text-[10px] text-slate-400">페이스</p>
                    <p className="text-sm font-bold text-orange-500">{calcPace(form.record_time, parseFloat(form.distance) || 0) || '-'}</p>
                  </div>
                </div>
              )}

              {/* 완주기록증(마라톤) / 대표 파일(치과 면허증) */}
              {(form.category === '마라톤' || form.category === '치과 면허증') && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">{form.category === '마라톤' ? '완주 기록증' : '파일 첨부'}</label>
                  <label className="flex items-center gap-2 w-full border-2 border-dashed border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer hover:border-teal-300 transition-colors">
                    <Paperclip size={16} className="text-slate-400" />
                    <span className="text-sm text-slate-400">{uploading ? '업로드 중...' : form.file_url ? '선택됨 ✓' : '파일 선택'}</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                  </label>
                </div>
              )}

              {/* 여러 장 사진 (사진기록/마라톤/청첩장) */}
              {(form.category === '사진기록' || form.category === '마라톤' || form.category === '청첩장') && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">{form.category === '마라톤' ? '사진 (함께 찍은 사진)' : form.category === '청첩장' ? '청첩장 사진 (세무용)' : '사진 (여러 장)'}</label>
                  <div className="flex flex-wrap gap-2">
                    {form.photos.map((url, i) => (
                      <div key={i} className="relative w-16 h-16">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" onClick={() => setLightbox(url)} className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer" />
                        <button onClick={() => setForm(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">×</button>
                      </div>
                    ))}
                    <label className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-teal-300 text-slate-400 text-xs">
                      {uploading ? '...' : '+ 사진'}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) handlePhotos(e.target.files) }} />
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 resize-none"
                  rows={2} placeholder="간단한 메모..."
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <button onClick={handleSave} disabled={!form.title.trim() || uploading}
                className="w-full bg-teal-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-50 transition-colors">
                {editItem ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 축의금 추가/수정 모달 */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowGiftModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editGift ? '축의금 수정' : '축의금 추가'}</h3>
              <button onClick={() => setShowGiftModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">이름 *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  value={giftForm.name} onChange={e => setGiftForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">금액</label>
                  <input inputMode="numeric" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                    value={giftForm.amount} onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); setGiftForm(f => ({ ...f, amount: n ? Number(n).toLocaleString() : '' })) }} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                  <DatePickerInput value={giftForm.date} onChange={v => setGiftForm(f => ({ ...f, date: v }))} className="w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">방식 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  placeholder="현금/계좌이체/토스..." value={giftForm.method} onChange={e => setGiftForm(f => ({ ...f, method: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">비고 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  value={giftForm.note} onChange={e => setGiftForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              {editGift && <button onClick={deleteGift} className="w-full border border-red-200 text-red-400 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">삭제</button>}
              <button onClick={saveGift} disabled={!giftForm.name.trim()}
                className="w-full bg-rose-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 원본 보기 */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <div className="flex justify-center gap-2 mt-3">
              <button onClick={() => downloadPhoto(lightbox)} className="flex items-center gap-1.5 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"><Download size={16} /> 다운로드</button>
              <button onClick={() => setLightbox(null)} className="bg-white/20 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/30 transition-colors">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
