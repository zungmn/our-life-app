'use client'

import { useEffect, useState } from 'react'
import { supabase, Birthday, BirthdayGift } from '@/lib/supabase'
import { Plus, X, Trash2, Gift, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import DateInput from '@/components/DateInput'

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const THIS_MONTH = new Date().getMonth() + 1
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function nextBirthday(birthday: string) {
  const [m, d] = birthday.split('-').map(Number)
  const now = new Date()
  const thisYear = now.getFullYear()
  const bd = new Date(thisYear, m - 1, d)
  if (bd < now) bd.setFullYear(thisYear + 1)
  const diff = Math.ceil((bd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { days: diff, month: m, day: d }
}

export default function BirthdaysPage() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [gifts, setGifts] = useState<Record<string, BirthdayGift[]>>({})
  const [selected, setSelected] = useState<Birthday | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [form, setForm] = useState({ name: '', birthday: '', relation: '' })
  const [giftForm, setGiftForm] = useState({ year: new Date().getFullYear().toString(), direction: 'received' as 'received' | 'given', gift: '' })
  const [filterMonth, setFilterMonth] = useState(0)
  const [viewTab, setViewTab] = useState<'list' | 'calendar'>('list')
  const [calMonth, setCalMonth] = useState(new Date())

  const fetchAll = async () => {
    const { data: bds } = await supabase.from('birthdays').select('*').order('birthday', { ascending: true })
    setBirthdays(bds || [])
    if (bds && bds.length > 0) {
      const { data: gs } = await supabase.from('birthday_gifts').select('*').in('birthday_id', bds.map(b => b.id))
      const grouped: Record<string, BirthdayGift[]> = {}
      for (const g of (gs || [])) {
        if (!grouped[g.birthday_id]) grouped[g.birthday_id] = []
        grouped[g.birthday_id].push(g)
      }
      setGifts(grouped)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleSave = async () => {
    if (!form.name.trim() || !form.birthday) return
    const [, mm, dd] = form.birthday.split('-')
    await supabase.from('birthdays').insert({
      name: form.name,
      birthday: `${mm}-${dd}`,
      relation: form.relation || null,
    })
    setForm({ name: '', birthday: '', relation: '' })
    setShowModal(false)
    fetchAll()
  }

  const handleAddGift = async () => {
    if (!giftForm.gift.trim() || !selected) return
    await supabase.from('birthday_gifts').insert({
      birthday_id: selected.id,
      year: parseInt(giftForm.year),
      direction: giftForm.direction,
      gift: giftForm.gift,
    })
    setGiftForm({ year: new Date().getFullYear().toString(), direction: 'received', gift: '' })
    setShowGiftModal(false)
    fetchAll()
  }

  const handleDeleteGift = async (id: string) => {
    await supabase.from('birthday_gifts').delete().eq('id', id)
    fetchAll()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('birthdays').delete().eq('id', id)
    setSelected(null)
    fetchAll()
  }

  const sortedByUpcoming = [...birthdays].sort((a, b) => nextBirthday(a.birthday).days - nextBirthday(b.birthday).days)
  const byMonth = filterMonth > 0
    ? birthdays.filter(b => parseInt(b.birthday.split('-')[0]) === filterMonth)
    : sortedByUpcoming

  const selectedGifts = selected ? (gifts[selected.id] || []).sort((a, b) => b.year - a.year) : []

  return (
    <div className="p-6 md:p-10 max-w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎁 생일선물</h2>
          <p className="text-xs text-slate-400 mt-0.5">받은 선물, 준 선물 기록</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-rose-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-rose-600 transition-colors">
          <Plus size={16} /> 추가
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-4">
        {[{ k: 'list', l: '목록' }, { k: 'calendar', l: '캘린더' }].map(t => (
          <button key={t.k} onClick={() => setViewTab(t.k as typeof viewTab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewTab === t.k ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Birthday calendar */}
      {viewTab === 'calendar' && (
        <div className="card overflow-hidden mb-4">
          <div className="flex items-center justify-between p-3 border-b border-slate-100">
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16} /></button>
            <span className="font-semibold text-slate-800">{calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월</span>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {(() => {
              const m = calMonth.getMonth() + 1
              const year = calMonth.getFullYear()
              const firstDay = new Date(year, m - 1, 1)
              const lastDay = new Date(year, m, 0)
              const pad = firstDay.getDay()
              const daysInMonth = lastDay.getDate()
              const cells = []
              for (let i = 0; i < pad; i++) cells.push(<div key={`p${i}`} className="min-h-[70px] border-b border-r border-slate-50" />)
              for (let d = 1; d <= daysInMonth; d++) {
                const mm = String(m).padStart(2, '0')
                const dd = String(d).padStart(2, '0')
                const key = `${mm}-${dd}`
                const bds = birthdays.filter(b => b.birthday === key)
                const dow = new Date(year, m - 1, d).getDay()
                const isLast = d + pad > daysInMonth - 7 + pad
                cells.push(
                  <div key={d} className={`min-h-[70px] p-1 border-b border-r border-slate-50 ${isLast ? 'border-b-0' : ''}`}>
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}`}>{d}</div>
                    {bds.map(b => (
                      <button key={b.id} onClick={() => setSelected(b)} className="w-full text-left">
                        <div className="text-[10px] bg-rose-100 text-rose-600 px-1 py-0.5 rounded truncate mb-0.5">🎂 {b.name}</div>
                      </button>
                    ))}
                  </div>
                )
              }
              return cells
            })()}
          </div>
        </div>
      )}

      {/* Month filter */}
      {viewTab === 'list' && <>
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button onClick={() => setFilterMonth(0)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterMonth === 0 ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
          다가오는순
        </button>
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => setFilterMonth(i + 1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterMonth === i + 1 ? 'bg-rose-500 text-white' : i + 1 === THIS_MONTH ? 'bg-rose-50 text-rose-400' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}>
            {m}
          </button>
        ))}
      </div>

      {byMonth.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Gift size={48} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm">생일을 추가해보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {byMonth.map(bd => {
            const nb = nextBirthday(bd.birthday)
            const [m, d] = bd.birthday.split('-')
            const bdGifts = gifts[bd.id] || []
            return (
              <button key={bd.id} onClick={() => setSelected(bd)}
                className="card p-4 w-full text-left hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-rose-50 flex flex-col items-center justify-center flex-shrink-0">
                    <p className="text-[10px] text-rose-400 font-medium">{m}월</p>
                    <p className="text-lg font-bold text-rose-500">{d}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{bd.name}</p>
                      {bd.relation && <span className="text-xs text-slate-400">{bd.relation}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className={`text-xs font-medium ${nb.days <= 30 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {nb.days === 0 ? '🎂 오늘!' : nb.days === 1 ? '내일!' : `D-${nb.days}`}
                      </p>
                      <p className="text-xs text-slate-400">{bdGifts.length}개 기록</p>
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-slate-300 -rotate-90" />
                </div>
              </button>
            )
          })}
        </div>
      )}
      </>}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{selected.name}</h3>
                  <p className="text-sm text-slate-400">
                    {selected.birthday.replace('-', '월 ')}일{selected.relation ? ` · ${selected.relation}` : ''}
                  </p>
                  <p className={`text-xs font-medium mt-1 ${nextBirthday(selected.birthday).days <= 30 ? 'text-rose-500' : 'text-slate-400'}`}>
                    {nextBirthday(selected.birthday).days === 0 ? '🎂 오늘 생일!' : `D-${nextBirthday(selected.birthday).days}`}
                  </p>
                </div>
                <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">선물 기록</h4>
                <button onClick={() => setShowGiftModal(true)}
                  className="text-xs bg-rose-500 text-white px-2 py-1 rounded-lg hover:bg-rose-600 transition-colors">
                  + 추가
                </button>
              </div>

              {selectedGifts.length === 0 ? (
                <p className="text-xs text-slate-400">기록이 없어요</p>
              ) : (
                <div className="space-y-2">
                  {selectedGifts.map(g => (
                    <div key={g.id} className="flex items-center gap-2 group">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        g.direction === 'received' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {g.direction === 'received' ? '받음' : '줌'}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{g.year}년</span>
                      <p className="text-sm text-slate-700 flex-1">{g.gift}</p>
                      <button onClick={() => handleDeleteGift(g.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              <button onClick={() => handleDelete(selected.id)}
                className="flex items-center gap-2 text-red-400 text-sm hover:text-red-600 transition-colors">
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift add modal */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">선물 기록 추가</h3>
              <button onClick={() => setShowGiftModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {[
                  { v: 'received', label: '🎀 받은 선물' },
                  { v: 'given', label: '🎁 준 선물' }
                ].map(opt => (
                  <button key={opt.v} onClick={() => setGiftForm(f => ({ ...f, direction: opt.v as 'received' | 'given' }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      giftForm.direction === opt.v ? 'bg-rose-50 border-rose-300 text-rose-600' : 'border-slate-200 text-slate-500'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">년도</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  value={giftForm.year} onChange={e => setGiftForm(f => ({ ...f, year: e.target.value }))} />
              </div>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                placeholder="선물 내용" value={giftForm.gift}
                onChange={e => setGiftForm(f => ({ ...f, gift: e.target.value }))} autoFocus />
              <button onClick={handleAddGift} disabled={!giftForm.gift.trim()}
                className="w-full bg-rose-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add birthday modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">생일 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                placeholder="이름" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">생일 YYYY-MM-DD (월/일만 저장됩니다)</label>
                <DateInput value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">관계 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  placeholder="부모님, 친구, 동료 등" value={form.relation}
                  onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} />
              </div>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.birthday}
                className="w-full bg-rose-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
