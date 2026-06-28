'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Transaction, ClinicFinance } from '@/lib/supabase'
import { BUDGET_CATEGORIES, INCOME_CATEGORIES, SCOPE_LABEL, BudgetScope, catScopeOf, catSavingOf, catColorOf2, normalizeCat } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, getDay, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import DateInput from '@/components/DateInput'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const toNum = (s: string) => parseInt((s || '').replace(/[^0-9]/g, '') || '0', 10)
const fmt = (n: number) => n.toLocaleString() + '원'

// 통합 캘린더 항목
type CalItem = {
  id: string; source: 'tx' | 'clinic'; date: string; amount: number
  type: 'income' | 'expense'; memo: string; category: string
  scope: BudgetScope; is_saving: boolean; tx?: Transaction; cf?: ClinicFinance
}
const txToItem = (t: Transaction): CalItem => ({
  id: t.id, source: 'tx', date: t.date, amount: t.amount, type: t.type,
  memo: t.memo || t.category, category: normalizeCat(t.category),
  scope: catScopeOf(t.category), is_saving: t.type === 'expense' && catSavingOf(t.category), tx: t,
})
const cfToItem = (t: ClinicFinance): CalItem => ({
  id: t.id, source: 'clinic', date: t.date, amount: t.amount, type: t.type,
  memo: t.name || t.category || '', category: normalizeCat(t.category),
  scope: catScopeOf(t.category), is_saving: t.type === 'expense' && catSavingOf(t.category), cf: t,
})
const itemColor = (it: CalItem) => {
  if (it.type === 'income') return 'bg-green-50 text-green-600'
  if (it.is_saving) return 'bg-indigo-50 text-indigo-600'
  if (it.scope === 'hospital') return 'bg-rose-50 text-rose-500'
  if (it.scope === 'household') return 'bg-teal-50 text-teal-600'
  return 'bg-amber-50 text-amber-600' // personal
}

const SCOPES: BudgetScope[] = ['hospital', 'household', 'personal']

export default function ExpensesPage() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [clinicCal, setClinicCal] = useState<ClinicFinance[]>([])
  const [tab, setTab] = useState<'calendar' | 'stats'>('calendar')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Transaction | null>(null)
  const [editClinicItem, setEditClinicItem] = useState<ClinicFinance | null>(null)
  const [clinicMode, setClinicMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [monthRevenue, setMonthRevenue] = useState('')
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'), type: 'expense' as 'income' | 'expense',
    memo: '', amount: '', scope: 'hospital' as BudgetScope, is_saving: false, category: '직원',
  })

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
    const handler = () => setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
    window.addEventListener('viewer-change', handler)
    return () => window.removeEventListener('viewer-change', handler)
  }, [])

  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  const fetchData = useCallback(async () => {
    const v = (localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy'
    const cur = await supabase.from('transactions').select('*').gte('date', monthStart).lte('date', monthEnd).or(`owner.eq.${v},owner.is.null`).order('date', { ascending: false })
    setTransactions(cur.data || [])
    if (v === 'eddy') {
      const { data: cf } = await supabase.from('clinic_finance').select('*').gte('date', monthStart).lte('date', monthEnd)
      setClinicCal(cf || [])
    } else {
      setClinicCal([])
    }
  }, [currentDate, viewer])

  useEffect(() => { fetchData() }, [fetchData])

  // 이번 달 매출 (통계용) localStorage
  const revKey = `clinic_revenue_${format(currentDate, 'yyyy-MM')}`
  useEffect(() => { setMonthRevenue(localStorage.getItem(`clinic_revenue_${format(currentDate, 'yyyy-MM')}`) || '') }, [currentDate])
  const saveRevenue = (v: string) => { setMonthRevenue(v); if (v) localStorage.setItem(revKey, v); else localStorage.removeItem(revKey) }

  // 통합 항목 & 합계
  const monthItems: CalItem[] = [...transactions.map(txToItem), ...clinicCal.map(cfToItem)]
  const sum = (arr: CalItem[]) => arr.reduce((s, i) => s + i.amount, 0)
  const incomeItems = monthItems.filter(i => i.type === 'income')
  const expenseItems = monthItems.filter(i => i.type === 'expense' && !i.is_saving)
  const savingItems = monthItems.filter(i => i.type === 'expense' && i.is_saving)
  const totalIncome = sum(incomeItems)
  const totalExpense = sum(expenseItems)
  const totalSaving = sum(savingItems)
  // 치과 총 매출(수동 입력) + 수동 수입 = 이번 달 수입
  const displayIncome = totalIncome + (viewer === 'eddy' ? toNum(monthRevenue) : 0)
  const scopeTotal = (s: BudgetScope) => sum(expenseItems.filter(i => i.scope === s))

  // ===== 모달 =====
  const openAdd = (date?: string) => {
    setEditItem(null); setEditClinicItem(null); setClinicMode(viewer === 'eddy')
    setForm({ date: date || format(new Date(), 'yyyy-MM-dd'), type: 'expense', memo: '', amount: '', scope: 'hospital', is_saving: false, category: '직원' })
    setShowModal(true)
  }
  const openEdit = (t: Transaction) => {
    setEditItem(t); setEditClinicItem(null); setClinicMode(false)
    const cat = normalizeCat(t.category)
    setForm({ date: t.date, type: t.type, memo: t.memo || '', amount: t.amount.toLocaleString(), scope: catScopeOf(cat), is_saving: catSavingOf(cat), category: cat })
    setShowModal(true)
  }
  const openEditClinic = (t: ClinicFinance) => {
    setEditClinicItem(t); setEditItem(null); setClinicMode(true)
    const cat = normalizeCat(t.category)
    setForm({ date: t.date, type: t.type, memo: t.name || '', amount: t.amount.toLocaleString(), scope: catScopeOf(cat), is_saving: catSavingOf(cat), category: cat })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.amount || !form.category) return
    setLoading(true)
    const amount = toNum(form.amount)
    if (clinicMode) {
      const payload = {
        date: form.date, amount, type: form.type,
        scope: form.type === 'income' ? null : (form.scope === 'hospital' ? 'hospital' : 'personal'),
        category: form.category, name: form.memo || null, is_saving: form.is_saving,
      }
      const res = editClinicItem
        ? await supabase.from('clinic_finance').update(payload).eq('id', editClinicItem.id)
        : await supabase.from('clinic_finance').insert(payload)
      if (res.error) { alert('저장 실패: ' + res.error.message); setLoading(false); return }
    } else {
      const payload = { date: form.date, type: form.type, category: form.category, amount, memo: form.memo || null }
      const res = editItem
        ? await supabase.from('transactions').update(payload).eq('id', editItem.id)
        : await supabase.from('transactions').insert({ ...payload, owner: viewer })
      if (res.error) { alert('저장 실패: ' + res.error.message); setLoading(false); return }
    }
    await fetchData()
    setShowModal(false); setEditItem(null); setEditClinicItem(null); setLoading(false)
  }
  const handleDelete = async () => {
    if (!confirm('이 내역을 삭제할까요?')) return
    if (editClinicItem) await supabase.from('clinic_finance').delete().eq('id', editClinicItem.id)
    else if (editItem) await supabase.from('transactions').delete().eq('id', editItem.id)
    await fetchData()
    setShowModal(false); setEditItem(null); setEditClinicItem(null)
  }

  // ===== 통계 =====
  const revenueNum = toNum(monthRevenue)
  const pctOf = (v: number, base: number) => base > 0 ? Math.round(v / base * 1000) / 10 : 0
  // scope별 분류 분석
  const scopeBreakdown = (s: BudgetScope) => {
    const items = expenseItems.filter(i => i.scope === s)
    const map: Record<string, number> = {}
    for (const i of items) map[i.category] = (map[i.category] || 0) + i.amount
    const total = sum(items)
    const cats = Object.entries(map).map(([name, value]) => ({ name, value, color: catColorOf2(name), pct: pctOf(value, total) })).sort((a, b) => b.value - a.value)
    return { total, cats }
  }
  const savingBreakdown = (() => {
    const map: Record<string, number> = {}
    for (const i of savingItems) map[i.category] = (map[i.category] || 0) + i.amount
    return Object.entries(map).map(([name, value]) => ({ name, value, color: catColorOf2(name) })).sort((a, b) => b.value - a.value)
  })()
  // 경영 지표 (병원 경비 기준)
  const hospitalCatAmt = (name: string) => expenseItems.filter(i => i.scope === 'hospital' && i.category === name).reduce((s, i) => s + i.amount, 0)
  const hospitalTotal = scopeTotal('hospital')
  const netProfit = revenueNum - hospitalTotal
  const netMargin = pctOf(netProfit, revenueNum)
  const mgmtRatios = [
    { label: '인건비(직원)', val: hospitalCatAmt('직원'), healthy: 30, note: '25~30%' },
    { label: '기공료', val: hospitalCatAmt('기공료'), healthy: 12, note: '8~12%' },
    { label: '재료비', val: hospitalCatAmt('재료비'), healthy: 12, note: '8~12%' },
    { label: '임대료', val: hospitalCatAmt('임대료'), healthy: 7, note: '5~7%' },
    { label: '마케팅', val: hospitalCatAmt('마케팅'), healthy: 7, note: '3~7%' },
  ]

  const monthStartDate = startOfMonth(currentDate)
  const monthEndDate = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStartDate, end: monthEndDate })
  const startPad = getDay(monthStartDate)

  // 분류 옵션 (구분 기준 필터 + 가나다 정렬), 입력값으로 추가 검색
  const scopeCats = BUDGET_CATEGORIES.filter(c => c.scope === form.scope).map(c => c.value).sort((a, b) => a.localeCompare(b, 'ko'))
  const isExactCat = scopeCats.includes(form.category)
  const catOptions = (isExactCat || !form.category) ? scopeCats : scopeCats.filter(v => v.includes(form.category))

  // 4분할 합계 카드 데이터
  const bucketCards = [
    { label: '병원 경비', val: scopeTotal('hospital'), cls: 'text-rose-500' },
    { label: '가계', val: scopeTotal('household'), cls: 'text-teal-600' },
    { label: '개인', val: scopeTotal('personal'), cls: 'text-amber-600' },
    { label: '저축', val: totalSaving, cls: 'text-indigo-600' },
  ]

  return (
    <div className="p-6 md:p-10 max-w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">💰 Budget</h2>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => { setViewer('eddy'); localStorage.setItem('viewer', 'eddy'); window.dispatchEvent(new CustomEvent('viewer-change')) }}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${viewer === 'eddy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Eddy</button>
          <button onClick={() => { setViewer('judy'); localStorage.setItem('viewer', 'judy'); window.dispatchEvent(new CustomEvent('viewer-change')) }}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${viewer === 'judy' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}>Judy</button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} className="text-slate-600" /></button>
        <h2 className="text-lg font-semibold text-slate-700">{format(currentDate, 'yyyy년 M월')}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} className="text-slate-600" /></button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {[{ k: 'calendar', l: '캘린더' }, { k: 'stats', l: '통계' }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.k ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t.l}
            </button>
          ))}
        </div>
        <button onClick={() => openAdd()}
          className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
          <Plus size={14} /> 추가
        </button>
      </div>

      {/* 치과 총 매출 입력 (Eddy 전용) */}
      {viewer === 'eddy' && (
        <div className="card p-3 mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-400">이번 달 총 매출 (덴트웹)</p>
            <span className="text-[10px] text-slate-300">엑셀/HTML 연동 예정</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" placeholder="총 매출 입력"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              value={monthRevenue ? Number(monthRevenue).toLocaleString() : ''}
              onChange={e => saveRevenue(e.target.value.replace(/[^0-9]/g, ''))} />
            <span className="text-xs text-slate-400">원</span>
          </div>
        </div>
      )}

      {/* 수입 / 지출 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="card p-3"><p className="text-xs text-slate-400 mb-0.5">이번 달 수입</p><p className="text-base font-bold text-green-500">{fmt(displayIncome)}</p></div>
        <div className="card p-3"><p className="text-xs text-slate-400 mb-0.5">이번 달 지출</p><p className="text-base font-bold text-red-500">{fmt(totalExpense)}</p></div>
      </div>
      {/* 병원경비 / 가계 / 개인 / 저축 */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {bucketCards.map(b => (
          <div key={b.label} className="card p-2.5">
            <p className="text-[11px] text-slate-400 mb-0.5">{b.label}</p>
            <p className={`text-sm font-bold ${b.cls}`}>{fmt(b.val)}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      {tab === 'calendar' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-2.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} className="border-b border-r border-slate-50 min-h-[110px]" />)}
            {days.map((day, i) => {
              const ds = format(day, 'yyyy-MM-dd')
              const items = monthItems.filter(it => it.date === ds)
              const dow = getDay(day)
              const isLastRow = i >= days.length - 7
              const shown = items.slice(0, 6)
              const hiddenCount = items.length - shown.length
              return (
                <div key={ds} onClick={() => openAdd(ds)}
                  className={`border-b border-r border-slate-50 min-h-[110px] p-1 cursor-pointer hover:bg-slate-50/70 transition-colors ${isLastRow ? 'border-b-0' : ''}`}>
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday(day) ? 'bg-blue-500 text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}`}>{format(day, 'd')}</div>
                  <div className="space-y-0.5">
                    {shown.map(it => (
                      <div key={it.id}
                        onClick={e => e.stopPropagation()}
                        onDoubleClick={e => { e.stopPropagation(); it.source === 'tx' ? openEdit(it.tx!) : openEditClinic(it.cf!) }}
                        title={`${it.memo} · ${it.category}`}
                        className={`flex items-center gap-1 text-[11px] px-1 py-0.5 rounded cursor-pointer ${itemColor(it)}`}>
                        <span className="truncate flex-1">{it.memo}</span>
                        <span className="flex-shrink-0">{it.type === 'income' ? '+' : '-'}{it.amount.toLocaleString()}원</span>
                      </div>
                    ))}
                    {hiddenCount > 0 && <div className="text-[10px] text-slate-400 px-1">+{hiddenCount}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {/* 경영 지표 */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 mb-1 text-sm">📈 경영 지표 (병원 경비)</h3>
            <p className="text-[11px] text-slate-400 mb-3">위쪽 &apos;이번 달 총 매출&apos; 입력 시 매출 대비 비율과 순이익을 계산합니다</p>
            {revenueNum > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-0.5">순이익 (매출 − 병원경비)</p>
                    <p className={`text-base font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(netProfit)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-0.5">순이익률</p>
                    <p className={`text-base font-bold ${netMargin >= 25 ? 'text-green-600' : netMargin >= 0 ? 'text-amber-600' : 'text-red-500'}`}>{netMargin}%</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {mgmtRatios.map(r => {
                    const pct = pctOf(r.val, revenueNum)
                    const st = pct <= r.healthy ? ['양호', 'text-green-600 bg-green-50'] : pct <= r.healthy + 5 ? ['주의', 'text-amber-600 bg-amber-50'] : ['높음', 'text-red-500 bg-red-50']
                    return (
                      <div key={r.label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-24 flex-shrink-0">{r.label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full bg-blue-400" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                        <span className="text-xs font-medium text-slate-700 w-12 text-right">{pct}%</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full w-10 text-center ${st[1]}`}>{st[0]}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">* 매출 대비 · 치과 일반 권장: 인건비 25~30%, 기공료·재료비 8~12%, 임대료 5~7%</p>
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">매출 미입력 — 분류별 비율은 각 항목(병원경비/가계) 합계 대비로 표시됩니다</p>
            )}
          </div>

          {/* scope별 분류 분석 (개인 제외) */}
          {(['hospital', 'household'] as BudgetScope[]).map(s => {
            const bd = scopeBreakdown(s)
            if (bd.cats.length === 0) return null
            return (
              <div key={s} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800 text-sm">{SCOPE_LABEL[s]} 분류별</h3>
                  <span className="text-sm font-bold text-slate-700">{fmt(bd.total)}</span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(120, bd.cats.length * 26)}>
                  <BarChart data={bd.cats} layout="vertical" margin={{ top: 0, right: 10, left: 30, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}원`, '']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {bd.cats.map((c, idx) => <Cell key={idx} fill={c.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-1 space-y-1">
                  {bd.cats.map(c => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      <span className="text-slate-600 flex-1 truncate">{c.name}</span>
                      <span className="text-slate-700 font-medium">{fmt(c.value)}</span>
                      <span className="text-slate-400 w-10 text-right">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* 저축 */}
          {savingBreakdown.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 text-sm">저축</h3>
                <span className="text-sm font-bold text-indigo-600">{fmt(totalSaving)}</span>
              </div>
              <div className="space-y-1">
                {savingBreakdown.map(c => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-slate-600 flex-1 truncate">{c.name}</span>
                    <span className="text-slate-700 font-medium">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{(editItem || editClinicItem) ? '내역 수정' : '내역 추가'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              {/* 날짜 */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <DateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} className="w-full" />
              </div>
              {/* 1. 지출/수입 */}
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map(type => (
                  <button key={type} onClick={() => setForm(f => ({ ...f, type, category: type === 'income' ? INCOME_CATEGORIES[0].value : (BUDGET_CATEGORIES.find(c => c.scope === f.scope)?.value || '직원'), is_saving: type === 'income' ? false : f.is_saving }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === type ? (type === 'expense' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200') : 'border-slate-200 text-slate-500'}`}>
                    {type === 'expense' ? '지출' : '수입'}
                  </button>
                ))}
              </div>
              {/* 2. 메모 */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="메모..." value={form.memo} autoFocus
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave() }} />
              </div>
              {/* 3. 금액 */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">금액 (원)</label>
                <input type="text" inputMode="numeric" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="0" value={form.amount}
                  onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); setForm(f => ({ ...f, amount: n ? Number(n).toLocaleString() : '' })) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave() }} />
              </div>
              {form.type === 'expense' && (
                <>
                  {/* 4. 구분 */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">구분</label>
                    <div className="flex gap-2">
                      {SCOPES.map(s => (
                        <button key={s} onClick={() => setForm(f => {
                          const first = BUDGET_CATEGORIES.find(c => c.scope === s)
                          const keep = BUDGET_CATEGORIES.find(c => c.value === f.category && c.scope === s)
                          const cat = keep ? f.category : (first?.value || f.category)
                          return { ...f, scope: s, category: cat, is_saving: catSavingOf(cat) }
                        })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.scope === s ? 'bg-blue-50 text-blue-600 border-blue-200' : 'border-slate-200 text-slate-500'}`}>
                          {SCOPE_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 5. 저축 */}
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setForm(f => ({ ...f, is_saving: !f.is_saving }))}>
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.is_saving ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_saving ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">저축 항목</p>
                  </label>
                  {/* 6. 분류 (검색 + 목록 선택) */}
                  <div className="relative">
                    <label className="text-xs text-slate-500 mb-1 block">분류 (검색하거나 목록에서 선택)</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      placeholder="입력하거나 선택하세요" value={form.category}
                      onFocus={() => setCatOpen(true)}
                      onChange={e => { const v = e.target.value; setCatOpen(true); setForm(f => ({ ...f, category: v, is_saving: catSavingOf(v) || f.is_saving })) }}
                      onKeyDown={e => { if (e.key === 'Enter') { setCatOpen(false); handleSave() } }} />
                    {catOpen && catOptions.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setCatOpen(false)} />
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {catOptions.map(c => (
                            <button key={c} type="button"
                              onClick={() => { setForm(f => ({ ...f, category: c, scope: catScopeOf(c), is_saving: catSavingOf(c) })); setCatOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${form.category === c ? 'text-blue-600 font-medium' : 'text-slate-700'}`}>
                              {c}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
              {form.type === 'income' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">분류</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {INCOME_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}
              {(editItem || editClinicItem) && (
                <button onClick={handleDelete}
                  className="w-full border border-red-200 text-red-400 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">삭제</button>
              )}
              <button onClick={handleSave} disabled={loading || !form.amount}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
                {loading ? '저장 중...' : (editItem || editClinicItem) ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
