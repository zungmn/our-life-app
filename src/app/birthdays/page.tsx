'use client'

import { useEffect, useState } from 'react'
import { supabase, Birthday, BirthdayGift } from '@/lib/supabase'
import { Plus, X, Trash2, Gift, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import DateInput from '@/components/DateInput'
import { holidaysForYears } from '@/lib/holidays'

// 음력→양력 변환 (korean-lunar-calendar)
function lunarToSolarDate(year: number, lunarMM: string, lunarDD: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const KLC = require('korean-lunar-calendar')
    const cal = new KLC()
    cal.setLunarDate(year, parseInt(lunarMM, 10), parseInt(lunarDD, 10), false)
    const s = cal.getSolarCalendar()
    if (!s || !s.year) return null
    return `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`
  } catch {
    return null
  }
}

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const THIS_MONTH = new Date().getMonth() + 1
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

function nextBirthday(birthday: string) {
  const [m, d] = birthday.split('-').map(Number)
  const now = new Date()
  const thisYear = now.getFullYear()
  const bd = new Date(thisYear, m - 1, d)
  if (bd < now) bd.setFullYear(thisYear + 1)
  const diff = Math.ceil((bd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { days: diff, month: m, day: d }
}

export default function BirthdaysPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [gifts, setGifts] = useState<Record<string, BirthdayGift[]>>({})
  const [selected, setSelected] = useState<Birthday | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [form, setForm] = useState({ name: '', birthday: '', lunar_birthday: '', relation: '', show_in_calendar: false })
  const [editItem, setEditItem] = useState<Birthday | null>(null)
  const [editGift, setEditGift] = useState<BirthdayGift | null>(null)
  const [giftForm, setGiftForm] = useState({ year: new Date().getFullYear().toString(), direction: 'received' as 'received' | 'given', gift: '' })
  const [filterMonth, setFilterMonth] = useState(0)
  const [viewTab, setViewTab] = useState<'list' | 'calendar'>('calendar')
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

  const openEdit = (bd: Birthday) => {
    setSelected(null)
    setEditItem(bd)
    setForm({
      name: bd.name,
      birthday: `2000-${bd.birthday}`,
      lunar_birthday: bd.lunar_birthday || '',
      relation: bd.relation || '',
      show_in_calendar: bd.show_in_calendar || false,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.birthday) return
    const parts = form.birthday.split('-')
    const mm = parts.length >= 3 ? parts[1] : parts[0]
    const dd = parts.length >= 3 ? parts[2] : parts[1]
    if (!mm || !dd) return
    const payload = {
      name: form.name,
      birthday: `${mm}-${dd}`,
      relation: form.relation || null,
      lunar_birthday: form.lunar_birthday || null,
      show_in_calendar: form.show_in_calendar,
    }
    if (editItem) {
      await supabase.from('birthdays').update(payload).eq('id', editItem.id)
      await supabase.from('events').delete().eq('title', `🎂 ${form.name}`).eq('person', 'both')
      if (form.show_in_calendar) {
        const evs = buildBirthdayEvents(form.name, `${mm}-${dd}`, form.lunar_birthday || null, form.relation || null)
        for (const ev of evs) await supabase.from('events').insert(ev)
      }
    } else {
      const { data: inserted } = await supabase.from('birthdays').insert(payload).select().single()
      if (inserted && form.show_in_calendar) {
        const evs = buildBirthdayEvents(form.name, `${mm}-${dd}`, form.lunar_birthday || null, form.relation || null)
        for (const ev of evs) await supabase.from('events').insert(ev)
      }
    }
    setForm({ name: '', birthday: '', lunar_birthday: '', relation: '', show_in_calendar: false })
    setEditItem(null)
    setShowModal(false)
    fetchAll()
  }

  const openAddGift = () => {
    setEditGift(null)
    setGiftForm({ year: new Date().getFullYear().toString(), direction: 'received', gift: '' })
    setShowGiftModal(true)
  }

  const openEditGift = (g: BirthdayGift) => {
    setEditGift(g)
    setGiftForm({ year: String(g.year), direction: g.direction, gift: g.gift })
    setShowGiftModal(true)
  }

  const handleAddGift = async () => {
    if (!giftForm.gift.trim() || !selected) return
    if (editGift) {
      await supabase.from('birthday_gifts').update({
        year: parseInt(giftForm.year),
        direction: giftForm.direction,
        gift: giftForm.gift,
      }).eq('id', editGift.id)
    } else {
      await supabase.from('birthday_gifts').insert({
        birthday_id: selected.id,
        year: parseInt(giftForm.year),
        direction: giftForm.direction,
        gift: giftForm.gift,
      })
    }
    setGiftForm({ year: new Date().getFullYear().toString(), direction: 'received', gift: '' })
    setEditGift(null)
    setShowGiftModal(false)
    fetchAll()
  }

  const handleDeleteGift = async (id: string) => {
    await supabase.from('birthday_gifts').delete().eq('id', id)
    fetchAll()
  }

  const buildBirthdayEvents = (name: string, birthday: string, lunarBirthday: string | null | undefined, relation: string | null | undefined) => {
    const now = new Date()
    const events = []
    for (let y = now.getFullYear(); y <= now.getFullYear() + 2; y++) {
      let dateStr: string | null = null
      if (lunarBirthday) {
        const [lm, ld] = lunarBirthday.split('-')
        dateStr = lunarToSolarDate(y, lm, ld)
      }
      if (!dateStr) {
        const [m, d] = birthday.split('-')
        dateStr = `${y}-${m}-${d}`
      }
      if (dateStr) {
        events.push({
          title: `🎂 ${name}`,
          date: dateStr,
          person: 'both' as const,
          note: lunarBirthday
            ? `생일 (음력 ${lunarBirthday.replace('-', '월 ')}일)${relation ? ' · ' + relation : ''}`
            : relation ? `생일 · ${relation}` : '생일',
        })
      }
    }
    return events
  }

  const handleToggleCalendar = async (bd: Birthday) => {
    const next = !bd.show_in_calendar
    await supabase.from('birthdays').update({ show_in_calendar: next }).eq('id', bd.id)
    await supabase.from('events').delete().eq('title', `🎂 ${bd.name}`).eq('person', 'both')
    if (next) {
      const evs = buildBirthdayEvents(bd.name, bd.birthday, bd.lunar_birthday, bd.relation)
      for (const ev of evs) await supabase.from('events').insert(ev)
    }
    setSelected(s => s ? { ...s, show_in_calendar: next } : s)
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
    <div className={embedded ? 'max-w-full' : 'p-6 md:p-10 max-w-full'}>
      <div className="flex items-center justify-between mb-4">
        <div>
          {!embedded && <h2 className="text-2xl font-bold text-slate-800">🎂 기념일 및 생일</h2>}
          <p className="text-base font-semibold text-slate-500 mt-0.5">생일·기념일과 받은 선물, 준 선물 기록</p>
        </div>
        <button onClick={() => { setEditItem(null); setForm({ name: '', birthday: '', lunar_birthday: '', relation: '', show_in_calendar: false }); setShowModal(true) }}
          className="flex items-center gap-1 bg-rose-500 text-white px-4 py-2 rounded-lg text-[0.9rem] hover:bg-rose-600 transition-colors">
          <Plus size={16} /> 추가
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-4">
        {[{ k: 'list', l: '목록' }, { k: 'calendar', l: '캘린더' }].map(t => (
          <button key={t.k} onClick={() => setViewTab(t.k as typeof viewTab)}
            className={`px-4 py-2 rounded-lg text-[0.9rem] font-medium transition-colors ${viewTab === t.k ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Birthday calendar */}
      {viewTab === 'calendar' && (
        <div className="card overflow-hidden mb-4">
          <div className="flex items-center justify-between p-3 border-b border-slate-100">
            <div className="flex items-center gap-1">
              <button onClick={() => setCalMonth(new Date())} className="text-sm font-medium text-rose-500 hover:bg-rose-50 rounded-lg px-2.5 py-1 transition-colors">오늘</button>
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={24} /></button>
            </div>
            <span className="font-semibold text-slate-800 text-xl">{calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월</span>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={24} /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center text-base font-medium py-2 ${i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {(() => {
              const m = calMonth.getMonth() + 1
              const year = calMonth.getFullYear()
              const firstDay = new Date(year, m - 1, 1)
              const pad = (firstDay.getDay() + 6) % 7
              const daysInMonth = new Date(year, m, 0).getDate()
              const weeks = Math.ceil((pad + daysInMonth) / 7)
              const gridStart = new Date(year, m - 1, 1 - pad)
              const hol = holidaysForYears([year - 1, year, year + 1])
              return Array.from({ length: weeks * 7 }, (_, i) => {
                const cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
                const inMonth = cur.getMonth() === m - 1
                const mm = String(cur.getMonth() + 1).padStart(2, '0')
                const dd = String(cur.getDate()).padStart(2, '0')
                const ds = `${cur.getFullYear()}-${mm}-${dd}`
                const holiday = hol[ds]
                const bds = birthdays.filter(b => b.birthday === `${mm}-${dd}`)
                const dow = cur.getDay()
                const isLast = i >= (weeks - 1) * 7
                return (
                  <div key={i} className={`min-h-[100px] p-1 border-b border-r border-slate-50 ${isLast ? 'border-b-0' : ''} ${!inMonth ? 'bg-slate-50/40' : ''}`}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className={`text-base font-medium w-8 h-8 flex items-center justify-center rounded-full ${!inMonth ? (holiday ? 'text-red-300' : 'text-slate-300') : (holiday || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}`}>{cur.getDate()}</div>
                      {holiday && inMonth && <span className="text-[10px] text-red-400 truncate">{holiday}</span>}
                    </div>
                    {bds.map(b => (
                      <button key={b.id} onClick={() => setSelected(b)} className="w-full text-left">
                        <div className={`text-[13px] px-1 py-0.5 rounded truncate mb-0.5 ${inMonth ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>🎂 {b.name}</div>
                      </button>
                    ))}
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* Month filter */}
      {viewTab === 'list' && <>
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button onClick={() => setFilterMonth(0)}
          className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${filterMonth === 0 ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
          다가오는순
        </button>
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => setFilterMonth(i + 1)}
            className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${
              filterMonth === i + 1 ? 'bg-rose-500 text-white' : i + 1 === THIS_MONTH ? 'bg-rose-50 text-rose-400' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}>
            {m}
          </button>
        ))}
      </div>

      {byMonth.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Gift size={48} className="mx-auto mb-3 text-slate-200" />
          <p className="text-lg">생일을 추가해보세요</p>
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
                  <div className="w-16 h-16 rounded-full bg-rose-50 flex flex-col items-center justify-center flex-shrink-0">
                    <p className="text-sm text-rose-400 font-medium">{m}월</p>
                    <p className="text-2xl font-bold text-rose-500">{d}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 text-xl">{bd.name}</p>
                      {bd.relation && <span className="text-base text-slate-400">{bd.relation}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className={`text-base font-medium ${nb.days <= 30 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {nb.days === 0 ? '🎂 오늘!' : nb.days === 1 ? '내일!' : `D-${nb.days}`}
                      </p>
                      <p className="text-base text-slate-400">{bdGifts.length}개 기록</p>
                    </div>
                  </div>
                  <ChevronDown size={24} className="text-slate-300 -rotate-90" />
                </div>
              </button>
            )
          })}
        </div>
      )}
      </>}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-2xl text-slate-800">{selected.name}</h3>
                  <p className="text-lg text-slate-400">
                    {selected.birthday.replace('-', '월 ')}일{selected.relation ? ` · ${selected.relation}` : ''}
                    {selected.lunar_birthday && <span className="ml-1 text-slate-300">(음력 {selected.lunar_birthday.replace('-', '월 ')}일)</span>}
                  </p>
                  <p className={`text-base font-medium mt-1 ${nextBirthday(selected.birthday).days <= 30 ? 'text-rose-500' : 'text-slate-400'}`}>
                    {nextBirthday(selected.birthday).days === 0 ? '🎂 오늘 생일!' : `D-${nextBirthday(selected.birthday).days}`}
                  </p>
                </div>
                <button onClick={() => setSelected(null)}><X size={28} className="text-slate-400" /></button>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-slate-700">선물 기록</h4>
                <button onClick={openAddGift}
                  className="text-base bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition-colors">
                  + 추가
                </button>
              </div>

              {selectedGifts.length === 0 ? (
                <p className="text-base text-slate-400">기록이 없어요</p>
              ) : (
                <div className="space-y-2">
                  {selectedGifts.map(g => (
                    <div key={g.id} onDoubleClick={() => openEditGift(g)}
                      className="flex items-center gap-2 group cursor-pointer">
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        g.direction === 'received' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {g.direction === 'received' ? '받음' : '줌'}
                      </span>
                      <span className="text-base text-slate-400 flex-shrink-0">{g.year}년</span>
                      <p className="text-lg text-slate-700 flex-1">{g.gift}</p>
                      <button onClick={() => openEditGift(g)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-400 transition-all">
                        ✏️
                      </button>
                      <button onClick={() => handleDeleteGift(g.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 pb-5 space-y-3">
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleToggleCalendar(selected)}>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${selected.show_in_calendar ? 'bg-rose-400' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${selected.show_in_calendar ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-700">캘린더에 표시</p>
                  <p className="text-base text-slate-400">{selected.show_in_calendar ? '홈/캘린더에 생일 일정으로 표시됨' : '캘린더에 표시되지 않음'}</p>
                </div>
              </label>
              <div className="flex items-center gap-4">
                <button onClick={() => openEdit(selected)}
                  className="flex items-center gap-1 text-blue-500 text-lg hover:text-blue-700 transition-colors">
                  ✏️ 수정
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-2 text-red-400 text-lg hover:text-red-600 transition-colors">
                  <Trash2 size={20} /> 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gift add modal */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[60] p-4" onClick={() => { setShowGiftModal(false); setEditGift(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-xl">{editGift ? '선물 기록 수정' : '선물 기록 추가'}</h3>
              <button onClick={() => { setShowGiftModal(false); setEditGift(null) }}><X size={20} className="text-slate-400" /></button>
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
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); setEditItem(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-xl">{editItem ? '생일 수정' : '생일 추가'}</h3>
              <button onClick={() => { setShowModal(false); setEditItem(null) }}><X size={20} className="text-slate-400" /></button>
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
                <label className="text-xs text-slate-500 mb-1 block">음력 생일 (선택, MM-DD)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  placeholder="예: 04-15 (음력 4월 15일)" value={form.lunar_birthday}
                  onChange={e => setForm(f => ({ ...f, lunar_birthday: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">관계 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  placeholder="부모님, 친구, 동료 등" value={form.relation}
                  onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setForm(f => ({ ...f, show_in_calendar: !f.show_in_calendar }))}>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.show_in_calendar ? 'bg-rose-400' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.show_in_calendar ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">캘린더에 표시</p>
                  <p className="text-xs text-slate-400">{form.show_in_calendar ? '홈/캘린더에 생일 일정으로 표시됨' : '캘린더에 표시되지 않음'}</p>
                </div>
              </label>
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
