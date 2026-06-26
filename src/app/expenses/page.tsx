'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, Transaction, ClinicFinance } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, getDay, isToday, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'
import { Plus, X, ChevronLeft, ChevronRight, Trash2, TrendingUp, TrendingDown, Minus, Upload } from 'lucide-react'
import DateInput from '@/components/DateInput'

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const toNum = (s: string) => parseInt(s.replace(/,/g, '') || '0', 10)
const toComma = (s: string) => {
  const n = s.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString() : ''
}
const fmt = (n: number) => n.toLocaleString() + '원'

// 카테고리 → 그룹(병원 경비/생활비)
const catGroup = (cat?: string) => EXPENSE_CATEGORIES.find(c => c.value === cat)?.group

// 캘린더에 표시할 통합 항목 (개인 거래 + 치과 가계부)
type CalItem = {
  id: string; source: 'tx' | 'clinic'; date: string; amount: number
  type: 'income' | 'expense'; memo: string; category: string
  scope: 'hospital' | 'personal' | null; is_saving: boolean
  tx?: Transaction; cf?: ClinicFinance
}
const txToItem = (t: Transaction): CalItem => {
  const g = catGroup(t.category)
  return { id: t.id, source: 'tx', date: t.date, amount: t.amount, type: t.type,
    memo: t.memo || t.category, category: t.category,
    scope: g === '생활비' ? 'personal' : g === '병원 경비' ? 'hospital' : null,
    is_saving: t.category === '저축', tx: t }
}
const cfToItem = (t: ClinicFinance): CalItem => ({
  id: t.id, source: 'clinic', date: t.date, amount: t.amount, type: t.type,
  memo: t.name || t.category || '', category: t.category || '기타',
  scope: t.scope, is_saving: t.is_saving, cf: t,
})
const itemColor = (it: CalItem) => {
  if (it.is_saving) return 'bg-indigo-50 text-indigo-600'
  if (it.type === 'income') return 'bg-green-50 text-green-600'
  if (it.scope === 'personal') return 'bg-amber-50 text-amber-600'
  if (it.scope === 'hospital') return 'bg-rose-50 text-rose-500'
  return 'bg-red-50 text-red-600'
}

export default function ExpensesPage() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([])
  const [yearTransactions, setYearTransactions] = useState<Transaction[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Transaction | null>(null)
  const [editClinicItem, setEditClinicItem] = useState<ClinicFinance | null>(null)
  const [tab, setTab] = useState<'calendar' | 'list' | 'stats' | 'clinic'>('calendar')
  const [listTab, setListTab] = useState<'all' | 'expense' | 'income'>('all')
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), type: 'expense' as 'income' | 'expense', category: '직원', amount: '', memo: '', scope: 'hospital' as 'hospital' | 'personal', is_saving: false })
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 치과 가계부 (clinic_finance)
  const [clinicTx, setClinicTx] = useState<ClinicFinance[]>([])
  const [clinicYear, setClinicYear] = useState(new Date().getFullYear())
  const [clinicMonth, setClinicMonth] = useState(0) // 0 = 연간 전체
  const [clinicCal, setClinicCal] = useState<ClinicFinance[]>([]) // 캘린더 표시용 (현재 달, Eddy만)

  // Judy는 치과 탭 접근 불가
  useEffect(() => { if (viewer !== 'eddy' && tab === 'clinic') setTab('calendar') }, [viewer, tab])

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
    const handler = () => setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
    window.addEventListener('viewer-change', handler)
    return () => window.removeEventListener('viewer-change', handler)
  }, [])

  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')
  const prevStart = format(startOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
  const prevEnd = format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
  const yearStart = format(startOfYear(currentDate), 'yyyy-MM-dd')
  const yearEnd = format(endOfYear(currentDate), 'yyyy-MM-dd')

  const fetchTransactions = useCallback(async () => {
    const v = (localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy'
    const [cur, prev, yr] = await Promise.all([
      supabase.from('transactions').select('*').gte('date', monthStart).lte('date', monthEnd).or(`owner.eq.${v},owner.is.null`).order('date', { ascending: false }),
      supabase.from('transactions').select('*').gte('date', prevStart).lte('date', prevEnd).or(`owner.eq.${v},owner.is.null`),
      supabase.from('transactions').select('*').gte('date', yearStart).lte('date', yearEnd).or(`owner.eq.${v},owner.is.null`),
    ])
    setTransactions(cur.data || [])
    setPrevTransactions(prev.data || [])
    setYearTransactions(yr.data || [])
    // 치과 가계부도 캘린더에 표시 (Eddy 화면에서만)
    if (v === 'eddy') {
      const { data: cf } = await supabase.from('clinic_finance').select('*').gte('date', monthStart).lte('date', monthEnd)
      setClinicCal(cf || [])
    } else {
      setClinicCal([])
    }
  }, [currentDate, viewer])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  // 치과 가계부 데이터 (선택 연도 전체) 로드
  const fetchClinic = useCallback(async () => {
    const { data } = await supabase.from('clinic_finance').select('*')
      .gte('date', `${clinicYear}-01-01`).lte('date', `${clinicYear}-12-31`)
      .order('date', { ascending: false })
    setClinicTx(data || [])
  }, [clinicYear])

  useEffect(() => { if (tab === 'clinic') fetchClinic() }, [tab, fetchClinic])

  const openAdd = () => {
    setEditItem(null)
    setEditClinicItem(null)
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), type: 'expense', category: '직원', amount: '', memo: '', scope: 'hospital', is_saving: false })
    setShowModal(true)
  }
  const openEdit = (t: Transaction) => {
    setEditItem(t)
    setEditClinicItem(null)
    setForm({ date: t.date, type: t.type, category: t.category, amount: t.amount.toLocaleString(), memo: t.memo || '', scope: 'hospital', is_saving: false })
    setShowModal(true)
  }
  const openEditClinic = (t: ClinicFinance) => {
    setEditClinicItem(t)
    setEditItem(null)
    setForm({ date: t.date, type: t.type, category: t.category || '기타', amount: t.amount.toLocaleString(), memo: t.name || '', scope: (t.scope || 'hospital'), is_saving: t.is_saving })
    setShowModal(true)
  }

  const expenses = transactions.filter(t => t.type === 'expense')
  const incomes = transactions.filter(t => t.type === 'income')
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0)
  const totalSavings = totalIncome - totalExpense

  const prevExpense = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const prevSavings = prevIncome - prevExpense

  const categoryTotals = EXPENSE_CATEGORIES.map(cat => {
    const total = expenses.filter(t => t.category === cat.value).reduce((s, t) => s + t.amount, 0)
    return { name: cat.label, value: total, color: cat.color }
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  const displayed = listTab === 'all' ? transactions : transactions.filter(t => t.type === listTab)

  // 캘린더 통합 항목 (개인 거래 + 치과) 및 이번 달 합계
  const monthItems: CalItem[] = [...transactions.map(txToItem), ...clinicCal.map(cfToItem)]
  const calExpenseTotal = monthItems.filter(i => i.type === 'expense' && !i.is_saving).reduce((s, i) => s + i.amount, 0)
  const calSavingTotal = monthItems.filter(i => i.is_saving).reduce((s, i) => s + i.amount, 0)
  const calIncomeTotal = monthItems.filter(i => i.type === 'income' && !i.is_saving).reduce((s, i) => s + i.amount, 0)

  // Yearly monthly data for chart
  const months = eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) })
  const yearlyData = months.map(m => {
    const ms = format(startOfMonth(m), 'yyyy-MM-dd')
    const me = format(endOfMonth(m), 'yyyy-MM-dd')
    const mts = yearTransactions.filter(t => t.date >= ms && t.date <= me)
    const inc = mts.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = mts.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { month: format(m, 'M월'), income: inc, expense: exp, savings: inc - exp }
  })

  // ===== 치과 가계부 계산 =====
  const CLINIC_COLORS = ['#6366F1', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7']
  const clinicYears = [2024, 2025, 2026]
  // 선택 월(또는 연간)에 해당하는 거래
  const clinicScoped = clinicMonth === 0
    ? clinicTx
    : clinicTx.filter(t => parseInt(t.date.slice(5, 7), 10) === clinicMonth)
  const clinicHospital = clinicScoped.filter(t => t.scope === 'hospital' && !t.is_saving)
  const clinicPersonal = clinicScoped.filter(t => t.scope === 'personal' && !t.is_saving)
  const clinicSaving = clinicScoped.filter(t => t.is_saving)
  const sumAmt = (arr: ClinicFinance[]) => arr.reduce((s, t) => s + t.amount, 0)
  const clinicHospitalTotal = sumAmt(clinicHospital)
  const clinicPersonalTotal = sumAmt(clinicPersonal)
  const clinicSavingTotal = sumAmt(clinicSaving)

  // 병원 경비 카테고리별 (금액 + 비율)
  const clinicCatTotals = (() => {
    const map: Record<string, number> = {}
    for (const t of clinicHospital) { const c = t.category || '기타'; map[c] = (map[c] || 0) + t.amount }
    const arr = Object.entries(map).map(([name, value], i) => ({ name, value, pct: clinicHospitalTotal ? Math.round(value / clinicHospitalTotal * 1000) / 10 : 0, color: CLINIC_COLORS[i % CLINIC_COLORS.length] }))
    return arr.sort((a, b) => b.value - a.value)
  })()

  // 월별 병원 경비 추이 (선택 연도)
  const clinicMonthly = Array.from({ length: 12 }, (_, i) => {
    const mm = i + 1
    const rows = clinicTx.filter(t => parseInt(t.date.slice(5, 7), 10) === mm)
    return {
      month: `${mm}월`,
      hospital: sumAmt(rows.filter(t => t.scope === 'hospital' && !t.is_saving)),
      personal: sumAmt(rows.filter(t => t.scope === 'personal' && !t.is_saving)),
      saving: sumAmt(rows.filter(t => t.is_saving)),
    }
  })

  const handleSave = async () => {
    if (!form.amount || !form.category) return
    setLoading(true)
    const amount = toNum(form.amount)
    if (editClinicItem) {
      // 치과 가계부 항목 수정
      const { error } = await supabase.from('clinic_finance').update({
        date: form.date, amount, type: form.type, scope: form.scope,
        category: form.category, name: form.memo || null, is_saving: form.is_saving,
      }).eq('id', editClinicItem.id)
      if (error) { alert('수정 실패: ' + error.message); setLoading(false); return }
    } else if (editItem) {
      const { error } = await supabase.from('transactions').update({ date: form.date, type: form.type, category: form.category, amount, memo: form.memo || null }).eq('id', editItem.id)
      if (error) { alert('수정 실패: ' + error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.from('transactions').insert({ date: form.date, type: form.type, category: form.category, amount, memo: form.memo || null, owner: viewer })
      if (error) { alert('저장 실패: ' + error.message); setLoading(false); return }
    }
    await fetchTransactions()
    setShowModal(false)
    setEditItem(null)
    setEditClinicItem(null)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id)
    await fetchTransactions()
  }
  const handleDeleteClinic = async (id: string) => {
    await supabase.from('clinic_finance').delete().eq('id', id)
    await fetchTransactions()
  }

  // CSV 임포트 (노션 가계부 또는 일반 형식)
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { alert('데이터가 없습니다.'); setImporting(false); return }
    const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/("([^"]*)"|[^,]*)/g)?.map(c => c.replace(/"/g, '').trim()) || []
      const row: Record<string, string> = {}
      header.forEach((h, idx) => { row[h] = cols[idx] || '' })
      // Try to map common column names
      const date = row['날짜'] || row['date'] || row['Date'] || ''
      const type = row['유형'] || row['type'] || row['Type'] || ''
      const category = row['카테고리'] || row['category'] || ''
      const amountStr = row['금액'] || row['amount'] || row['Amount'] || ''
      const memo = row['메모'] || row['memo'] || row['내용'] || ''
      if (!date || !amountStr) continue
      const amount = parseInt(amountStr.replace(/[^0-9]/g, '') || '0', 10)
      if (!amount) continue
      const txType: 'income' | 'expense' = (type.includes('수입') || type === 'income') ? 'income' : 'expense'
      // Parse date: supports YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
      const dateMatch = date.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
      if (!dateMatch) continue
      const dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
      const matchedCat = ALL_CATEGORIES.find(c => c.label === category || c.value === category)
      rows.push({ date: dateStr, type: txType, category: matchedCat?.value || category || (txType === 'expense' ? '기타' : '기타수입'), amount, memo: memo || null, owner: viewer })
    }
    if (rows.length === 0) { alert('인식된 데이터가 없습니다.\n컬럼명: 날짜, 유형, 카테고리, 금액, 메모'); setImporting(false); return }
    const { error } = await supabase.from('transactions').insert(rows)
    if (error) { alert('임포트 실패: ' + error.message); setImporting(false); return }
    await fetchTransactions()
    alert(`${rows.length}건 임포트 완료!`)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const catColor = (category: string) => ALL_CATEGORIES.find(c => c.value === category)?.color || '#9CA3AF'

  const Diff = ({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) => {
    if (prev === 0) return null
    const d = cur - prev
    const pct = Math.round(Math.abs(d) / prev * 100)
    const up = d > 0
    const good = invert ? !up : up
    return (
      <span className={`text-xs flex items-center gap-0.5 ${good ? 'text-green-500' : 'text-red-500'}`}>
        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {pct}%
      </span>
    )
  }

  const calStart = startOfMonth(currentDate)
  const calEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const startPad = getDay(calStart)

  return (
    <div className="p-6 md:p-10 max-w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">💰 Budget</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button onClick={() => { setViewer('eddy'); localStorage.setItem('viewer', 'eddy'); window.dispatchEvent(new CustomEvent('viewer-change')) }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${viewer === 'eddy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Eddy</button>
            <button onClick={() => { setViewer('judy'); localStorage.setItem('viewer', 'judy'); window.dispatchEvent(new CustomEvent('viewer-change')) }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${viewer === 'judy' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}>Judy</button>
          </div>
        </div>
      </div>

      {tab !== 'clinic' && (
      <>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} className="text-slate-600" /></button>
        <h2 className="text-lg font-semibold text-slate-700">{format(currentDate, 'yyyy년 M월')}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} className="text-slate-600" /></button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: '지출', val: totalExpense, prev: prevExpense, color: 'text-red-500', invert: true },
          { label: '수입', val: totalIncome, prev: prevIncome, color: 'text-green-500', invert: false },
          { label: '저축', val: totalSavings, prev: prevSavings, color: totalSavings >= 0 ? 'text-slate-800' : 'text-red-500', invert: false },
        ].map(({ label, val, prev, color, invert }) => (
          <div key={label} className="card p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400">{label}</p>
              <Diff cur={val} prev={prev} invert={invert} />
            </div>
            <p className={`text-base font-bold ${color}`}>{fmt(val)}</p>
            {prev > 0 && <p className="text-[10px] text-slate-300 mt-0.5">전달 {fmt(prev)}</p>}
          </div>
        ))}
      </div>
      </>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {[{ k: 'calendar', l: '캘린더' }, { k: 'list', l: '목록' }, { k: 'stats', l: '통계' }, ...(viewer === 'eddy' ? [{ k: 'clinic', l: '🦷 치과' }] : [])].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.k ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t.l}
            </button>
          ))}
        </div>
        {tab !== 'clinic' && (
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer border border-slate-200 hover:bg-slate-50 transition-colors ${importing ? 'opacity-50' : ''}`}>
            <Upload size={12} /> CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} disabled={importing} />
          </label>
          <button onClick={openAdd}
            className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
            <Plus size={14} /> 추가
          </button>
        </div>
        )}
      </div>

      {/* List view */}
      {tab === 'list' && (
        <div className="card overflow-hidden">
          <div className="flex gap-1 p-3 border-b border-slate-100">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => setListTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${listTab === t ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          {displayed.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">내역이 없어요</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {displayed.map(t => (
                <div key={t.id} onDoubleClick={() => openEdit(t)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor(t.category) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.category}</p>
                      {t.memo && <p className="text-xs text-slate-400 truncate">{t.memo}</p>}
                    </div>
                    <p className="text-xs text-slate-400">{t.date}</p>
                  </div>
                  <p className={`text-sm font-semibold ${t.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                    {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()}
                  </p>
                  <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar view */}
      {tab === 'calendar' && (
        <>
        {/* 이번 달 합계 */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="card p-3">
            <p className="text-xs text-slate-400 mb-0.5">이번 달 지출 합계</p>
            <p className="text-base font-bold text-red-500">{fmt(calExpenseTotal)}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-slate-400 mb-0.5">이번 달 저축 합계</p>
            <p className="text-base font-bold text-indigo-600">{fmt(calSavingTotal)}</p>
          </div>
        </div>
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
                <div key={ds} className={`border-b border-r border-slate-50 min-h-[110px] p-1 ${isLastRow ? 'border-b-0' : ''}`}>
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday(day) ? 'bg-blue-500 text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}`}>{format(day, 'd')}</div>
                  <div className="space-y-0.5">
                    {shown.map(it => (
                      <div key={it.id} onDoubleClick={() => it.source === 'tx' ? openEdit(it.tx!) : openEditClinic(it.cf!)}
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
        </>
      )}

      {/* Stats view */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {/* Category chart */}
          {categoryTotals.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm">📊 카테고리별 지출 ({format(currentDate, 'M월', { locale: ko })})</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={categoryTotals} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
                  <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}원`, '지출']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryTotals.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Yearly chart */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">📅 {format(currentDate, 'yyyy년')} 월별 수입/지출</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
                <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString()}원`, name === 'income' ? '수입' : name === 'expense' ? '지출' : '저축']} />
                <Legend formatter={v => v === 'income' ? '수입' : v === 'expense' ? '지출' : '저축'} />
                <Bar dataKey="income" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" fill="#EF4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Savings line */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 mb-1 text-sm">💰 월별 저축 추이</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}원`, '저축']} />
                <Line type="monotone" dataKey="savings" stroke="#6366F1" strokeWidth={2} dot={{ fill: '#6366F1', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="text-slate-500">올해 누적 저축</span>
              <span className={`font-bold ${yearTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) - yearTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                {fmt(yearTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) - yearTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}
              </span>
            </div>
          </div>

          {/* Month comparison detail */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">📈 전달 대비</h3>
            <div className="space-y-3">
              {[
                { label: '수입', cur: totalIncome, prev: prevIncome, color: 'text-green-600', good: (d: number) => d >= 0 },
                { label: '지출', cur: totalExpense, prev: prevExpense, color: 'text-red-500', good: (d: number) => d <= 0 },
                { label: '저축', cur: totalSavings, prev: prevSavings, color: 'text-indigo-600', good: (d: number) => d >= 0 },
              ].map(({ label, cur, prev, good }) => {
                const diff = cur - prev
                const pct = prev > 0 ? Math.round(Math.abs(diff) / prev * 100) : null
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-8">{label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(100, prev > 0 ? (cur / Math.max(cur, prev)) * 100 : 0)}%` }} />
                    </div>
                    <span className="text-sm font-medium text-slate-700 w-24 text-right">{fmt(cur)}</span>
                    {pct !== null && (
                      <span className={`text-xs w-14 text-right flex items-center justify-end gap-0.5 ${good(diff) ? 'text-green-500' : 'text-red-500'}`}>
                        {diff > 0 ? <TrendingUp size={11} /> : diff < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                        {pct}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 치과 가계부 view */}
      {tab === 'clinic' && (
        <div className="space-y-4">
          {/* 연도 / 월 선택 */}
          <div className="card p-3 space-y-2">
            <div className="flex gap-1">
              {clinicYears.map(y => (
                <button key={y} onClick={() => setClinicYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${clinicYear === y ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {y}년
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setClinicMonth(0)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${clinicMonth === 0 ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}>연간</button>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button key={m} onClick={() => setClinicMonth(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${clinicMonth === m ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}>{m}월</button>
              ))}
            </div>
          </div>

          {clinicTx.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-slate-500 mb-3">치과 가계부 데이터가 없습니다.</p>
              <p className="text-xs text-slate-400 mb-4">노션에서 가져온 1,376건의 거래를 불러오려면 아래 버튼을 누르세요.<br/>(DB 테이블을 먼저 만들어야 합니다 — 설명 참고)</p>
              <button onClick={async () => {
                if (!confirm('노션 치과 가계부 데이터를 불러올까요?')) return
                const res = await fetch('/api/import-clinic-finance', { method: 'POST' })
                const json = await res.json()
                alert(json.message || json.error || '완료')
                fetchClinic()
              }} className="bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors">
                노션 데이터 불러오기
              </button>
            </div>
          ) : (
            <>
              {/* 요약 카드 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-3">
                  <p className="text-xs text-slate-400 mb-1">병원 경비</p>
                  <p className="text-base font-bold text-red-500">{fmt(clinicHospitalTotal)}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">{clinicHospital.length}건</p>
                </div>
                <div className="card p-3">
                  <p className="text-xs text-slate-400 mb-1">생활비</p>
                  <p className="text-base font-bold text-orange-500">{fmt(clinicPersonalTotal)}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">{clinicPersonal.length}건</p>
                </div>
                <div className="card p-3">
                  <p className="text-xs text-slate-400 mb-1">저축</p>
                  <p className="text-base font-bold text-indigo-600">{fmt(clinicSavingTotal)}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">{clinicSaving.length}건</p>
                </div>
              </div>

              {/* 병원 경비 카테고리별 (금액 + 비율) */}
              <div className="card p-4">
                <h3 className="font-semibold text-slate-800 mb-1 text-sm">🦷 병원 경비 분류별 {clinicMonth === 0 ? `(${clinicYear}년 전체)` : `(${clinicYear}년 ${clinicMonth}월)`}</h3>
                <p className="text-[11px] text-slate-400 mb-3">비율은 병원 경비 합계 대비 (매출 대비 비율은 매출 연동 후 제공)</p>
                {clinicCatTotals.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">해당 기간 병원 경비 내역이 없어요</p>
                ) : (
                  <div className="space-y-2">
                    {clinicCatTotals.map(c => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-20 flex-shrink-0 truncate">{c.name}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                          <div className="h-2.5 rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-24 text-right">{fmt(c.value)}</span>
                        <span className="text-[11px] text-slate-400 w-12 text-right">{c.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 월별 추이 (선택 연도) */}
              <div className="card p-4">
                <h3 className="font-semibold text-slate-800 mb-3 text-sm">📅 {clinicYear}년 월별 지출 추이</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={clinicMonthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                    onClick={(e) => { const i = e?.activeTooltipIndex; if (typeof i === 'number') setClinicMonth(i + 1) }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
                    <Tooltip formatter={(v, n) => [`${Number(v).toLocaleString()}원`, n === 'hospital' ? '병원 경비' : n === 'personal' ? '생활비' : '저축']} />
                    <Legend formatter={v => v === 'hospital' ? '병원 경비' : v === 'personal' ? '생활비' : '저축'} />
                    <Bar dataKey="hospital" fill="#EF4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="personal" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="saving" fill="#6366F1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-slate-400 mt-1 text-center">막대를 클릭하면 해당 월 상세를 볼 수 있어요</p>
              </div>

              {/* 상세 내역 (선택 기간) */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">상세 내역 ({clinicScoped.length}건)</h3>
                </div>
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                  {clinicScoped.slice(0, 200).map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${t.scope === 'hospital' ? 'bg-red-50 text-red-500' : t.scope === 'personal' ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-500'}`}>
                        {t.scope === 'hospital' ? '병원' : t.scope === 'personal' ? '생활' : '-'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate">{t.name || t.category}</p>
                        <p className="text-xs text-slate-400">{t.date} · {t.category}</p>
                      </div>
                      <p className={`text-sm font-semibold ${t.is_saving ? 'text-indigo-600' : 'text-red-500'}`}>
                        {t.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {clinicScoped.length > 200 && <p className="text-xs text-slate-400 text-center py-3">+{clinicScoped.length - 200}건 더 있음</p>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editClinicItem ? '내역 수정' : editItem ? '내역 수정' : '내역 추가'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map(type => (
                  <button key={type} onClick={() => setForm(f => ({ ...f, type, category: editClinicItem ? f.category : (type === 'expense' ? '직원' : '진료 수입') }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === type ? (type === 'expense' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200') : 'border-slate-200 text-slate-500'}`}>
                    {type === 'expense' ? '지출' : '수입'}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <DateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} className="w-full" />
              </div>
              {editClinicItem ? (
                <>
                  {/* 병원경비 / 생활비 */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">구분</label>
                    <div className="flex gap-2">
                      {([['hospital', '병원 경비'], ['personal', '생활비']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setForm(f => ({ ...f, scope: v }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.scope === v ? (v === 'hospital' ? 'bg-rose-50 text-rose-500 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200') : 'border-slate-200 text-slate-500'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">분류</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      placeholder="예: 기공료, 재료비, 직원..." value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setForm(f => ({ ...f, is_saving: !f.is_saving }))}>
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.is_saving ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_saving ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">저축 항목</p>
                  </label>
                </>
              ) : (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">카테고리</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {form.type === 'expense' ? (
                      <>
                        <optgroup label="병원 경비">{EXPENSE_CATEGORIES.filter(c => c.group === '병원 경비').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>
                        <optgroup label="생활비">{EXPENSE_CATEGORIES.filter(c => c.group === '생활비').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>
                      </>
                    ) : INCOME_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">금액 (원)</label>
                <input type="text" inputMode="numeric" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: toComma(e.target.value) }))} />
                {form.amount && <p className="text-xs text-slate-400 mt-1">{toNum(form.amount).toLocaleString()}원</p>}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="메모..." value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
              {(editItem || editClinicItem) && (
                <button onClick={async () => {
                  if (!confirm('이 내역을 삭제할까요?')) return
                  if (editClinicItem) await handleDeleteClinic(editClinicItem.id)
                  else if (editItem) await handleDelete(editItem.id)
                  setShowModal(false); setEditItem(null); setEditClinicItem(null)
                }} className="w-full border border-red-200 text-red-400 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">
                  삭제
                </button>
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
