'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Transaction, ClinicFinance } from '@/lib/supabase'
import { BUDGET_CATEGORIES, INCOME_CATEGORIES, SCOPE_LABEL, BudgetScope, catScopeOf, catSavingOf, catColorOf2, normalizeCat } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, getDay, isToday, subDays, addDays, isSameMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import DateInput from '@/components/DateInput'
import { holidaysForYears } from '@/lib/holidays'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']
const toNum = (s: string) => parseInt((s || '').replace(/[^0-9]/g, '') || '0', 10)
const fmt = (n: number) => n.toLocaleString() + '원'
const won = (n: number) => n ? Math.round(n / 10000).toLocaleString() + '만' : '-'

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
  scope: catScopeOf(t.category), is_saving: t.type === 'expense' && (t.is_saving || catSavingOf(t.category)), cf: t,
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
  const [uploadName, setUploadName] = useState('')
  const [statPeriod, setStatPeriod] = useState<'month' | 'year'>('month')
  const [statYear, setStatYear] = useState(new Date().getFullYear())
  const [analysisMonth, setAnalysisMonth] = useState<string | null>(null) // A카드: 특정 월 상세, null=6개월평균
  const [yearItemsRaw, setYearItemsRaw] = useState<CalItem[]>([])
  const [allItems, setAllItems] = useState<CalItem[]>([])
  const [ymEdit, setYmEdit] = useState(false)
  // 잔금 현황 (매달 리셋 X, 항상 유지) — Supabase(app_state)에 저장하여 기기 간 공유
  const [balances, setBalances] = useState<Record<string, number>>({})
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_state').select('value').eq('key', 'budget_balances').maybeSingle()
      if (data?.value) { setBalances(data.value as Record<string, number>); return }
      // 최초 1회: 예전 localStorage 값이 있으면 이전(migrate)
      try {
        const local = JSON.parse(localStorage.getItem('budget_balances') || '{}')
        if (local && Object.keys(local).length) {
          setBalances(local)
          await supabase.from('app_state').upsert({ key: 'budget_balances', value: local })
        }
      } catch { /* noop */ }
    })()
  }, [])
  const setBalance = async (k: string, v: number) => {
    const nb = { ...balances, [k]: v }
    setBalances(nb)
    await supabase.from('app_state').upsert({ key: 'budget_balances', value: nb })
  }
  const adjustBalance = (k: string, label: string, unit: string) => {
    const ex = unit === '돈' ? '0.7' : '50000'
    const s = prompt(`${label} 증감액 입력 (더하기 예: ${ex}, 빼기 예: -${ex})`)
    if (s == null) return
    const d = parseFloat(s.replace(/[^0-9.\-]/g, '') || '0')
    if (d) setBalance(k, Math.round(((balances[k] || 0) + d) * 100) / 100)
  }
  const BALANCE_ITEMS: [string, string, string][] = [['exposed', '노출 현금', '원'], ['hidden', '비노출 현금', '원'], ['safe', '금고', '원'], ['voucher', '상품권', '원'], ['pharma', '제약', '원'], ['gold', '골드바', '돈']]
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

  // 캘린더 그리드(전/다음 달 포함) 범위
  const monthStartD = startOfMonth(currentDate)
  const startPad = (getDay(monthStartD) + 6) % 7 // 월요일 시작
  const gridStart = subDays(monthStartD, startPad)
  const monthStart = format(gridStart, 'yyyy-MM-dd')
  const monthEnd = format(addDays(gridStart, 41), 'yyyy-MM-dd')

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

  // 연간 통계용 데이터
  const fetchYear = useCallback(async () => {
    const v = (localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy'
    const y = currentDate.getFullYear()
    const ys = `${y}-01-01`, ye = `${y}-12-31`
    const tx = await supabase.from('transactions').select('*').gte('date', ys).lte('date', ye).or(`owner.eq.${v},owner.is.null`)
    let items: CalItem[] = (tx.data || []).map(txToItem)
    if (v === 'eddy') {
      const cf = await supabase.from('clinic_finance').select('*').gte('date', ys).lte('date', ye)
      items = [...items, ...(cf.data || []).map(cfToItem)]
    }
    setYearItemsRaw(items)
  }, [currentDate, viewer])
  useEffect(() => { if (tab === 'stats' && statPeriod === 'year') fetchYear() }, [tab, statPeriod, fetchYear])

  // 통계 전체 기간 데이터 (월별/연별 개요) — Supabase 1000행 제한 대비 페이지네이션
  const fetchAll = useCallback(async () => {
    const v = (localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy'
    const txRows: Transaction[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('transactions').select('*').or(`owner.eq.${v},owner.is.null`).range(from, from + 999)
      if (!data || data.length === 0) break
      txRows.push(...data)
      if (data.length < 1000) break
    }
    let items: CalItem[] = txRows.map(txToItem)
    if (v === 'eddy') {
      const cfRows: ClinicFinance[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('clinic_finance').select('*').range(from, from + 999)
        if (!data || data.length === 0) break
        cfRows.push(...data)
        if (data.length < 1000) break
      }
      items = [...items, ...cfRows.map(cfToItem)]
    }
    setAllItems(items)
  }, [viewer])
  useEffect(() => { if (tab === 'stats') fetchAll() }, [tab, fetchAll])

  // 덴트웹 파일에서 총 매출 자동 인식 (csv/html/텍스트)
  const handleRevenueFile = async (file: File) => {
    setUploadName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') {
      alert('엑셀(xlsx)은 아직 자동 인식이 어려워요. CSV/HTML로 저장해 올리거나 총 매출을 직접 입력해 주세요. (샘플 주시면 엑셀도 맞춰드립니다)')
      return
    }
    const text = await file.text()
    const plain = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    const toN = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10)
    let found = 0
    const m = plain.match(/(총\s*매출|매출\s*합계|총\s*진료비|총\s*수납|총\s*수입|합\s*계)[^\d]{0,14}([\d,]{4,})/)
    if (m) found = toN(m[2])
    if (!found) {
      const days = [...plain.matchAll(/일\s*매출[^\d]{0,8}([\d,]{4,})/g)].map(x => toN(x[1]))
      if (days.length) found = days.reduce((a, b) => a + b, 0)
    }
    if (found > 0) { saveRevenue(String(found)); alert(`총 매출 ${found.toLocaleString()}원으로 인식했습니다.`) }
    else alert('총 매출을 자동 인식하지 못했어요. 파일 형식(샘플)을 알려주시면 맞춰드릴게요. 우선 위에 직접 입력해 주세요.')
  }

  // 이번 달 매출 (통계용) localStorage
  const revKey = `clinic_revenue_${format(currentDate, 'yyyy-MM')}`
  const revDaysKey = `clinic_revenue_days_${format(currentDate, 'yyyy-MM')}`
  const [revenueByDay, setRevenueByDay] = useState<Record<string, number>>({})
  useEffect(() => {
    const ymK = format(currentDate, 'yyyy-MM')
    setMonthRevenue(localStorage.getItem(`clinic_revenue_${ymK}`) || '')
    try { setRevenueByDay(JSON.parse(localStorage.getItem(`clinic_revenue_days_${ymK}`) || '{}')) } catch { setRevenueByDay({}) }
  }, [currentDate])
  const saveRevenue = (v: string) => { setMonthRevenue(v); if (v) localStorage.setItem(revKey, v); else localStorage.removeItem(revKey) }
  const saveRevenueDays = (days: { date: string; total: number }[]) => {
    const map: Record<string, number> = {}
    for (const d of days) if (d?.date) map[d.date] = Number(d.total || 0)
    setRevenueByDay(map)
    localStorage.setItem(revDaysKey, JSON.stringify(map))
  }

  // 통합 항목 (캘린더는 그리드 전체, 합계는 이번 달만)
  const monthItems: CalItem[] = [...transactions.map(txToItem), ...clinicCal.map(cfToItem)]
  const ym = format(currentDate, 'yyyy-MM')
  const curMonthItems = monthItems.filter(i => i.date.slice(0, 7) === ym)
  const sum = (arr: CalItem[]) => arr.reduce((s, i) => s + i.amount, 0)
  const incomeItems = curMonthItems.filter(i => i.type === 'income')
  const expenseItems = curMonthItems.filter(i => i.type === 'expense' && !i.is_saving)
  const savingItems = curMonthItems.filter(i => i.type === 'expense' && i.is_saving)
  const totalIncome = sum(incomeItems)
  const totalExpense = sum(expenseItems)
  const totalSaving = sum(savingItems)
  // 치과 총 매출(수동 입력) + 수동 수입 = 이번 달 수입
  const displayIncome = totalIncome + (viewer === 'eddy' ? toNum(monthRevenue) : 0)
  const scopeTotal = (s: BudgetScope) => sum(expenseItems.filter(i => i.scope === s))
  // 요약 카드 (모바일 2열 순서: 수입·지출 / 병원경비·가계 / 개인·저축)
  const summaryCards: { label: string; val: number; cls: string; income?: boolean }[] = [
    { label: '이번 달 수입', val: displayIncome, cls: 'text-green-500', income: true },
    { label: '이번 달 지출', val: totalExpense, cls: 'text-red-500' },
    ...(viewer === 'eddy' ? [{ label: '병원 경비', val: scopeTotal('hospital'), cls: 'text-rose-500' }] : []),
    { label: '가계', val: scopeTotal('household'), cls: 'text-teal-600' },
    { label: '개인', val: scopeTotal('personal'), cls: 'text-amber-600' },
    { label: '저축', val: totalSaving, cls: 'text-indigo-600' },
  ]

  // ===== 모달 =====
  const openAdd = (date?: string) => {
    setEditItem(null); setEditClinicItem(null); setClinicMode(viewer === 'eddy')
    const defScope: BudgetScope = viewer === 'eddy' ? 'hospital' : 'household'
    const defCat = BUDGET_CATEGORIES.find(c => c.scope === defScope)?.value || '직원'
    setForm({ date: date || format(new Date(), 'yyyy-MM-dd'), type: 'expense', memo: '', amount: '', scope: defScope, is_saving: false, category: defCat })
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

  // ===== 통계 (월간/연간) =====
  const pctOf = (v: number, base: number) => base > 0 ? Math.round(v / base * 1000) / 10 : 0
  // 임대료+관리비는 합쳐서 표시
  const mergeRent = (c: string) => (c === '관리비' || c === '임대료') ? '임대료+관리비' : c
  const statBase = statPeriod === 'year' ? yearItemsRaw : monthItems
  const statExpense = statBase.filter(i => i.type === 'expense' && !i.is_saving)
  const statSaving = statBase.filter(i => i.type === 'expense' && i.is_saving)
  const statTotalSaving = sum(statSaving)
  // 연간 매출 = 해당 연도 월별 localStorage 합
  const annualRevenue = (() => {
    if (typeof window === 'undefined') return 0
    const y = currentDate.getFullYear()
    let t = 0
    for (let mo = 1; mo <= 12; mo++) t += toNum(localStorage.getItem(`clinic_revenue_${y}-${String(mo).padStart(2, '0')}`) || '0')
    return t
  })()
  const revenueNum = statPeriod === 'year' ? annualRevenue : toNum(monthRevenue)
  // scope별 분류 분석 (임대료+관리비 병합)
  const scopeBreakdown = (s: BudgetScope) => {
    const items = statExpense.filter(i => i.scope === s)
    const map: Record<string, number> = {}
    for (const i of items) { const k = mergeRent(i.category); map[k] = (map[k] || 0) + i.amount }
    const total = sum(items)
    const cats = Object.entries(map).map(([name, value]) => ({ name, value, color: catColorOf2(name === '임대료+관리비' ? '임대료' : name), pct: pctOf(value, total) })).sort((a, b) => b.value - a.value)
    return { total, cats }
  }
  const savingBreakdown = (() => {
    const map: Record<string, number> = {}
    for (const i of statSaving) map[i.category] = (map[i.category] || 0) + i.amount
    return Object.entries(map).map(([name, value]) => ({ name, value, color: catColorOf2(name) })).sort((a, b) => b.value - a.value)
  })()
  // 경영 지표 (병원 경비 기준)
  const hospCatAmt = (name: string) => statExpense.filter(i => i.scope === 'hospital' && i.category === name).reduce((s, i) => s + i.amount, 0)
  const hospitalTotal = sum(statExpense.filter(i => i.scope === 'hospital'))
  const netProfit = revenueNum - hospitalTotal
  const netMargin = pctOf(netProfit, revenueNum)
  const mgmtRatios = [
    { label: '인건비(직원)', val: hospCatAmt('직원'), healthy: 30, note: '25~30%' },
    { label: '기공료', val: hospCatAmt('기공료'), healthy: 12, note: '8~12%' },
    { label: '재료비', val: hospCatAmt('재료비'), healthy: 12, note: '8~12%' },
    { label: '임대료+관리비', val: hospCatAmt('임대료') + hospCatAmt('관리비'), healthy: 9, note: '7~9%' },
    { label: '마케팅', val: hospCatAmt('마케팅'), healthy: 7, note: '3~7%' },
  ]

  // ===== 기간별 개요 (월별/연별) =====
  const periodKey = (d: string) => statPeriod === 'year' ? d.slice(0, 4) : d.slice(0, 7)
  const periodLabel = (k: string) => statPeriod === 'year' ? `${k}년` : `${k.slice(0, 4)}.${k.slice(5, 7)}`
  const revenueForPeriod = (k: string) => {
    if (viewer !== 'eddy' || typeof window === 'undefined') return 0
    if (statPeriod === 'year') { let r = 0; for (let m = 1; m <= 12; m++) r += toNum(localStorage.getItem(`clinic_revenue_${k}-${String(m).padStart(2, '0')}`) || '0'); return r }
    return toNum(localStorage.getItem(`clinic_revenue_${k}`) || '0')
  }
  type Agg = { key: string; income: number; expense: number; hospital: number; household: number; personal: number; saving: number; revenue: number }
  const emptyAgg = (k: string): Agg => ({ key: k, income: 0, expense: 0, hospital: 0, household: 0, personal: 0, saving: 0, revenue: 0 })
  const overview: Agg[] = (() => {
    const map: Record<string, Agg> = {}
    for (const it of allItems) {
      const k = periodKey(it.date)
      const o = map[k] = map[k] || emptyAgg(k)
      if (it.type === 'income') o.income += it.amount
      else if (it.is_saving) o.saving += it.amount
      else { o.expense += it.amount; o[it.scope] += it.amount }
    }
    // 매출(localStorage)만 있는 기간도 포함
    if (viewer === 'eddy' && typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const sk = localStorage.key(i)
        if (sk?.startsWith('clinic_revenue_') && !sk.startsWith('clinic_revenue_days_')) { const k = periodKey(sk.replace('clinic_revenue_', '') + '-01'); if (!map[k]) map[k] = emptyAgg(k) }
      }
    }
    const keys = Object.keys(map)
    if (keys.length === 0) return []
    // 빠진 기간 채우기 (연속)
    keys.sort()
    const full: string[] = []
    if (statPeriod === 'year') {
      for (let y = parseInt(keys[0]); y <= parseInt(keys[keys.length - 1]); y++) full.push(String(y))
    } else {
      const [sy, sm] = keys[0].split('-').map(Number)
      const [ey, em] = keys[keys.length - 1].split('-').map(Number)
      for (let y = sy, mo = sm; y < ey || (y === ey && mo <= em);) { full.push(`${y}-${String(mo).padStart(2, '0')}`); mo++; if (mo > 12) { mo = 1; y++ } }
    }
    return full.map(k => { const o = map[k] || emptyAgg(k); const rev = revenueForPeriod(k); return { ...o, revenue: rev, income: o.income + rev } }).sort((a, b) => a.key < b.key ? 1 : -1)
  })()

  // 월별 시계열 (차트용, 최근 12개월): 매출/지출/병원경비/순이익/3개월 이동평균
  const monthSeries = (() => {
    const map: Record<string, { hospital: number; expense: number; saving: number }> = {}
    for (const it of allItems) {
      const k = it.date.slice(0, 7)
      const o = map[k] = map[k] || { hospital: 0, expense: 0, saving: 0 }
      if (it.type === 'expense' && it.is_saving) o.saving += it.amount
      else if (it.type === 'expense') { o.expense += it.amount; if (it.scope === 'hospital') o.hospital += it.amount }
    }
    const keys = Object.keys(map)
    if (keys.length === 0) return []
    keys.sort()
    const [sy, sm] = keys[0].split('-').map(Number)
    const [ey, em] = keys[keys.length - 1].split('-').map(Number)
    const full: string[] = []
    for (let y = sy, mo = sm; y < ey || (y === ey && mo <= em);) { full.push(`${y}-${String(mo).padStart(2, '0')}`); mo++; if (mo > 12) { mo = 1; y++ } }
    const arr = full.map(k => {
      const o = map[k] || { hospital: 0, expense: 0, saving: 0 }
      const rev = viewer === 'eddy' && typeof window !== 'undefined' ? toNum(localStorage.getItem(`clinic_revenue_${k}`) || '0') : 0
      return { key: k, label: `${k.slice(2, 4)}.${k.slice(5, 7)}`, revenue: rev, expense: o.expense, hospital: o.hospital, saving: o.saving, profit: rev - o.hospital }
    })
    return arr.map((o, i) => { const w = arr.slice(Math.max(0, i - 2), i + 1); return { ...o, ma3: Math.round(w.reduce((s, x) => s + x.profit, 0) / w.length) } }).slice(-12)
  })()
  const breakEven = monthSeries.length ? monthSeries[monthSeries.length - 1].hospital : 0
  // 분류 분석: 최신 기간 vs 직전 기간
  const curKey = overview[0]?.key
  const prevKey = overview[1]?.key
  const catMap = (key: string | undefined, sel: (i: CalItem) => boolean) => {
    const m: Record<string, number> = {}
    if (!key) return m
    for (const it of allItems) { if (periodKey(it.date) !== key || !sel(it)) continue; const n = mergeRent(it.category); m[n] = (m[n] || 0) + it.amount }
    return m
  }
  const buildAnalysis = (sel: (i: CalItem) => boolean) => {
    const cur = catMap(curKey, sel), prev = catMap(prevKey, sel)
    const names = [...new Set([...Object.keys(cur), ...Object.keys(prev)])]
    const curRev = curKey ? revenueForPeriod(curKey) : 0
    return names.map(name => {
      const c = cur[name] || 0, p = prev[name] || 0
      const delta = p > 0 ? Math.round((c - p) / p * 1000) / 10 : null
      return { name, cur: c, prev: p, delta, revPct: curRev > 0 ? pctOf(c, curRev) : null, color: catColorOf2(name === '임대료+관리비' ? '임대료' : name) }
    }).filter(x => x.cur > 0 || x.prev > 0).sort((a, b) => b.cur - a.cur)
  }
  const anaHospital = buildAnalysis(i => i.type === 'expense' && !i.is_saving && i.scope === 'hospital')

  // ===== 지출 분석 (병원 경비: 전월/전년동월/최근6개월평균 대비) =====
  const hospByMonth: Record<string, number> = {}
  const hospCatByMonth: Record<string, Record<string, number>> = {}
  for (const it of allItems) {
    if (it.type !== 'expense' || it.is_saving || it.scope !== 'hospital') continue
    const k = it.date.slice(0, 7)
    hospByMonth[k] = (hospByMonth[k] || 0) + it.amount
    const cat = mergeRent(it.category)
    hospCatByMonth[k] = hospCatByMonth[k] || {}
    hospCatByMonth[k][cat] = (hospCatByMonth[k][cat] || 0) + it.amount
  }
  const cmKey = format(currentDate, 'yyyy-MM')
  const prevMKey = format(subMonths(currentDate, 1), 'yyyy-MM')
  const lastYearKey = format(subMonths(currentDate, 12), 'yyyy-MM')
  const deltaPct = (cur: number, base: number) => base > 0 ? Math.round((cur - base) / base * 1000) / 10 : null
  const expenseAnalysis = (() => {
    const catNames = new Set<string>(Object.keys(hospCatByMonth[cmKey] || {}))
    const defs: { name: string; get: (k: string) => number }[] = [{ name: '병원 경비 전체', get: k => hospByMonth[k] || 0 }]
    for (const c of catNames) defs.push({ name: c, get: k => hospCatByMonth[k]?.[c] || 0 })
    return defs.map(d => {
      const cur = d.get(cmKey), pm = d.get(prevMKey), ly = d.get(lastYearKey)
      let s = 0, n = 0
      for (let i = 1; i <= 6; i++) { s += d.get(format(subMonths(currentDate, i), 'yyyy-MM')); n++ }
      const a6 = n ? s / n : 0
      return { name: d.name, cur, avg6: Math.round(a6), dPrev: deltaPct(cur, pm), dYear: deltaPct(cur, ly), dAvg6: deltaPct(cur, a6) }
    }).filter(r => r.cur > 0 || r.name === '병원 경비 전체').sort((a, b) => a.name === '병원 경비 전체' ? -1 : b.name === '병원 경비 전체' ? 1 : b.cur - a.cur)
  })()

  // ===== 3년 순수익 라인차트 (x=1~12월, 연도별 선) =====
  const profitYears = Array.from(new Set(Object.keys(hospByMonth).map(k => k.slice(0, 4)).concat(
    typeof window !== 'undefined' && viewer === 'eddy' ? Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) || '').filter(s => s.startsWith('clinic_revenue_') && !s.startsWith('clinic_revenue_days_')).map(s => s.replace('clinic_revenue_', '').slice(0, 4)) : []
  ))).sort()
  const recentYears = profitYears.slice(-3)
  const olderYears = profitYears.slice(0, -3)
  const profitChartData = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, '0')
    const row: Record<string, number | string> = { month: `${i + 1}월` }
    for (const y of recentYears) {
      const k = `${y}-${mm}`
      const rev = viewer === 'eddy' && typeof window !== 'undefined' ? toNum(localStorage.getItem(`clinic_revenue_${k}`) || '0') : 0
      row[y] = rev - (hospByMonth[k] || 0)
    }
    return row
  })
  const YEAR_COLORS: Record<string, string> = { }
  recentYears.forEach((y, i) => { YEAR_COLORS[y] = ['#3B82F6', '#F59E0B', '#EC4899', '#10B981'][i] || '#94A3B8' })

  // ===== 월간 통계 (연도 선택 + 월 카드 + A 분석) =====
  const monthMap: Record<string, Agg> = {}
  for (const it of allItems) { const k = it.date.slice(0, 7); const o = monthMap[k] = monthMap[k] || emptyAgg(k); if (it.type === 'income') o.income += it.amount; else if (it.is_saving) o.saving += it.amount; else { o.expense += it.amount; o[it.scope] += it.amount } }
  const revMonth = (k: string) => viewer === 'eddy' && typeof window !== 'undefined' ? toNum(localStorage.getItem(`clinic_revenue_${k}`) || '0') : 0
  const monthAgg = (k: string): Agg => { const o = monthMap[k] || emptyAgg(k); const rev = revMonth(k); return { ...o, revenue: rev, income: o.income + rev } }
  const dataYears = Array.from(new Set([...Object.keys(monthMap).map(k => k.slice(0, 4)), ...recentYears, String(new Date().getFullYear())])).map(Number).filter(y => !isNaN(y)).sort((a, b) => b - a)
  const monthCards = (() => {
    const now = new Date()
    const maxM = statYear === now.getFullYear() ? now.getMonth() + 1 : 12
    const arr: string[] = []
    for (let m = maxM; m >= 1; m--) arr.push(`${statYear}-${String(m).padStart(2, '0')}`)
    return arr
  })()
  // 병원경비 6개월(지난달까지) 평균 분류별
  const hosp6Avg = (() => {
    const months: string[] = []
    for (let i = 1; i <= 6; i++) months.push(format(subMonths(currentDate, i), 'yyyy-MM'))
    const sum: Record<string, number> = {}
    for (const k of months) { const cm = hospCatByMonth[k] || {}; for (const c of Object.keys(cm)) sum[c] = (sum[c] || 0) + cm[c] }
    const cats = Object.entries(sum).map(([name, tot]) => ({ name, avg: Math.round(tot / 6), color: catColorOf2(name === '임대료+관리비' ? '임대료' : name) }))
    const total = cats.reduce((s, c) => s + c.avg, 0)
    return { months, total, cats: cats.map(c => ({ ...c, pct: total ? Math.round(c.avg / total * 1000) / 10 : 0 })).sort((a, b) => b.avg - a.avg) }
  })()
  const hospMonthDetail = (k: string) => {
    const cm = hospCatByMonth[k] || {}
    const cats = Object.entries(cm).map(([name, amt]) => ({ name, amt, color: catColorOf2(name === '임대료+관리비' ? '임대료' : name) }))
    const total = cats.reduce((s, c) => s + c.amt, 0)
    return { total, cats: cats.map(c => ({ ...c, pct: total ? Math.round(c.amt / total * 1000) / 10 : 0 })).sort((a, b) => b.amt - a.amt) }
  }
  const hospDeltas = (k: string) => {
    const cur = hospByMonth[k] || 0
    const [y, m] = k.split('-').map(Number)
    const base = new Date(y, m - 1, 1)
    const pm = hospByMonth[format(subMonths(base, 1), 'yyyy-MM')] || 0
    const ly = hospByMonth[`${y - 1}-${String(m).padStart(2, '0')}`] || 0
    let s = 0; for (let i = 1; i <= 6; i++) s += hospByMonth[format(subMonths(base, i), 'yyyy-MM')] || 0
    return { dPrev: deltaPct(cur, pm), dYear: deltaPct(cur, ly), dAvg6: deltaPct(cur, s / 6) }
  }
  // 증감률 배지 (상승 빨강, 하락 파랑)
  const deltaBadge = (d: number | null, label: string) => (
    <span className="inline-flex items-center gap-0.5 text-xs">
      <span className="text-slate-400">{label}</span>
      {d == null ? <span className="text-slate-300">–</span> : <span className={d > 0 ? 'text-red-500' : d < 0 ? 'text-blue-500' : 'text-slate-400'}>{d > 0 ? '▲' : d < 0 ? '▼' : ''}{Math.abs(d)}%</span>}
    </span>
  )

  // 캘린더 그리드 (필요한 만큼만 5주/6주)
  const weeks = Math.ceil((startPad + endOfMonth(currentDate).getDate()) / 7)
  const gridDays = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))
  const cyBudget = currentDate.getFullYear()
  const holidays = holidaysForYears([cyBudget - 1, cyBudget, cyBudget + 1])

  // 분류 옵션 (구분 기준 필터 + 가나다 정렬), 입력값으로 추가 검색
  const scopeCats = BUDGET_CATEGORIES.filter(c => c.scope === form.scope).map(c => c.value).sort((a, b) => a.localeCompare(b, 'ko'))
  const isExactCat = scopeCats.includes(form.category)
  const catOptions = (isExactCat || !form.category) ? scopeCats : scopeCats.filter(v => v.includes(form.category))

  // 구분 옵션 / 합계 카드 (Judy는 병원 경비 제외)
  const scopeOptions: BudgetScope[] = viewer === 'eddy' ? SCOPES : (['household', 'personal'] as BudgetScope[])
  const bucketCards = [
    ...(viewer === 'eddy' ? [{ label: '병원 경비', val: scopeTotal('hospital'), cls: 'text-rose-500' }] : []),
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

      {/* Tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[{ k: 'calendar', l: '캘린더' }, { k: 'stats', l: '통계' }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.k ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t.l}
              </button>
            ))}
          </div>
          {tab === 'stats' && (
            <div className="flex gap-1 border-l border-slate-200 pl-2">
              {([['month', '월간'], ['year', '연간']] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setStatPeriod(k); setAnalysisMonth(null) }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${statPeriod === k ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => openAdd()}
          className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
          <Plus size={14} /> 추가
        </button>
      </div>

      {tab === 'calendar' && (<>
      {/* Month nav (오늘 + 년/월 직접 선택) */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-blue-500 hover:bg-blue-50 rounded-lg px-2.5 py-1 transition-colors">오늘</button>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} className="text-slate-600" /></button>
          <button onClick={() => setYmEdit(v => !v)} className="text-lg font-semibold text-slate-700 hover:bg-slate-100 rounded-lg px-2 py-1 transition-colors">{format(currentDate, 'yyyy년 M월')}</button>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} className="text-slate-600" /></button>
        </div>
        <span className="w-10" />
      </div>
      {ymEdit && (
        <div className="card p-3 mb-3 flex items-center gap-2 justify-center">
          <input type="number" value={currentDate.getFullYear()}
            onChange={e => { const y = parseInt(e.target.value, 10); if (y > 1900 && y < 3000) setCurrentDate(new Date(y, currentDate.getMonth(), 1)) }}
            className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-blue-400" />
          <span className="text-sm text-slate-500">년</span>
          <select value={currentDate.getMonth() + 1}
            onChange={e => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value, 10) - 1, 1))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="text-sm text-slate-500">월</span>
          <button onClick={() => setYmEdit(false)} className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600">확인</button>
        </div>
      )}

      {/* 요약(좌) + 잔금 현황(우, Eddy)
          모바일: 수입·지출 / 병원경비·가계 / 개인·저축 / 잔금현황(전폭) 순으로 세로 배치 */}
      <div className="flex flex-col md:flex-row gap-3 mb-4 items-stretch">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-2">
          {summaryCards.map(c => (
            <div key={c.label} className="card p-3 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1 gap-1">
                <p className="text-sm text-slate-400">{c.label}</p>
                {c.income && viewer === 'eddy' && (
                  <button onClick={async () => {
                    try {
                      const res = await fetch(`/api/clinic-revenue?month=${format(currentDate, 'yyyy-MM')}`)
                      const j = await res.json()
                      if (j.error) { alert('불러오기 실패: ' + j.error); return }
                      saveRevenue(String(j.total || 0))
                      if (Array.isArray(j.days)) saveRevenueDays(j.days)
                      alert(`이번 달 매출 ${Number(j.total || 0).toLocaleString()}원을 불러왔습니다.`)
                    } catch { alert('연결 실패') }
                  }} className="text-[11px] px-2 py-0.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0">OS 불러오기</button>
                )}
              </div>
              <p className={`text-lg font-bold ${c.cls}`}>{fmt(c.val)}</p>
            </div>
          ))}
        </div>
        {viewer === 'eddy' && (
          <div className="card p-3 w-full md:w-[300px] flex-shrink-0">
            <p className="text-base text-slate-500 mb-1.5 font-semibold">💰 잔금 현황</p>
            <div className="space-y-1.5">
              {BALANCE_ITEMS.map(([k, l, unit]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className="text-sm text-slate-500 flex-shrink-0">{l}</span>
                  <span className="text-base text-slate-700 font-medium flex-1 text-right tabular-nums">{(balances[k] || 0).toLocaleString()}</span>
                  <span className="text-xs text-slate-400">{unit}</span>
                  <button onClick={() => adjustBalance(k, l, unit)} className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm flex-shrink-0">+</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Calendar grid */}
      <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center text-sm font-medium py-2.5 ${i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map((day, i) => {
              const ds = format(day, 'yyyy-MM-dd')
              const inMonth = isSameMonth(day, currentDate)
              const items = monthItems.filter(it => it.date === ds)
              const dow = getDay(day)
              const isLastRow = i >= (weeks - 1) * 7
              const shown = items.slice(0, 6)
              const hiddenCount = items.length - shown.length
              const holiday = holidays[ds]
              return (
                <div key={ds} onClick={() => openAdd(ds)}
                  className={`border-b border-r border-slate-50 min-h-[110px] p-1 cursor-pointer hover:bg-slate-50/70 transition-colors ${isLastRow ? 'border-b-0' : ''} ${!inMonth ? 'bg-slate-50/40' : ''}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-blue-500 text-white' : !inMonth ? (holiday ? 'text-red-300' : 'text-slate-300') : (holiday || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}`}>{format(day, 'd')}</div>
                    {holiday && inMonth && <span className="text-xs text-red-400 truncate">{holiday}</span>}
                  </div>
                  <div className="space-y-0.5">
                    {viewer === 'eddy' && revenueByDay[ds] > 0 && (
                      <div className="flex items-center gap-1 text-[13px] px-1 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        <span className="truncate flex-1">매출</span>
                        <span className="flex-shrink-0">+{revenueByDay[ds].toLocaleString()}원</span>
                      </div>
                    )}
                    {shown.map(it => (
                      <div key={it.id}
                        onClick={e => e.stopPropagation()}
                        onDoubleClick={e => { e.stopPropagation(); it.source === 'tx' ? openEdit(it.tx!) : openEditClinic(it.cf!) }}
                        title={`${it.memo} · ${it.category}`}
                        className={`flex items-center gap-1 text-[13px] px-1 py-0.5 rounded cursor-pointer ${itemColor(it)}`}>
                        <span className="truncate flex-1">{it.memo}</span>
                        <span className="flex-shrink-0">{it.type === 'income' ? '+' : '-'}{it.amount.toLocaleString()}원</span>
                      </div>
                    ))}
                    {hiddenCount > 0 && <div className="text-xs text-slate-400 px-1">+{hiddenCount}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </>)}

      {/* Stats */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {/* 연도 선택 (월간: 그 해 12개월) */}
          {statPeriod === 'month' && (
            <div className="flex gap-1.5 flex-wrap">
              {dataYears.map(y => (
                <button key={y} onClick={() => { setStatYear(y); setAnalysisMonth(null) }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${statYear === y ? 'bg-indigo-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
                  {y}년
                </button>
              ))}
            </div>
          )}
          {statPeriod === 'month' ? (
            <div className="flex flex-col md:flex-row gap-3 items-start">
              {/* 월 카드 (최신 월 먼저) */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
                {monthCards.map(k => {
                  const a = monthAgg(k); const profit = a.revenue - a.hospital; const d = hospDeltas(k)
                  const active = analysisMonth === k
                  return (
                    <button key={k} onClick={() => setAnalysisMonth(active ? null : k)}
                      className={`card p-3.5 text-left transition-shadow hover:shadow-md min-h-[116px] flex flex-col ${active ? 'ring-2 ring-indigo-300' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl font-bold text-slate-800">{parseInt(k.slice(5, 7))}월</span>
                        <span className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{won(profit)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-base mb-2">
                        <div className="flex justify-between"><span className="text-green-500 font-medium">수입</span><span className="text-slate-600">{won(a.revenue)}</span></div>
                        <div className="flex justify-between"><span className="text-rose-400 font-medium">경비</span><span className="text-slate-600">{won(a.hospital)}</span></div>
                      </div>
                      <div className="flex justify-between items-center gap-1 border-t border-slate-50 pt-1.5 mt-auto text-sm">
                        {deltaBadge(d.dPrev, '전월')}{deltaBadge(d.dYear, '작년')}{deltaBadge(d.dAvg6, '6M')}
                      </div>
                    </button>
                  )
                })}
              </div>
              {/* A: 병원 경비 분석 */}
              {viewer === 'eddy' && (
                <div className="card p-3 w-full md:w-[26%] md:min-w-[120px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    {analysisMonth && <button onClick={() => setAnalysisMonth(null)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">←</button>}
                    <h3 className="font-semibold text-slate-800 text-[15px] flex-1">🏥 병원 경비 분석</h3>
                    <span className="text-[11px] text-slate-400">{analysisMonth ? `${analysisMonth.slice(0, 4)}년 ${parseInt(analysisMonth.slice(5, 7))}월` : '최근 6개월 평균'}</span>
                  </div>
                  {(() => {
                    const data = analysisMonth ? hospMonthDetail(analysisMonth) : { total: hosp6Avg.total, cats: hosp6Avg.cats.map(c => ({ name: c.name, amt: c.avg, pct: c.pct, color: c.color })) }
                    if (data.cats.length === 0) return <p className="text-[13px] text-slate-400 py-4 text-center">데이터가 없어요</p>
                    return (
                      <>
                        <p className="text-sm text-slate-500 mb-2">총 {fmt(data.total)}{analysisMonth ? '' : ' (월평균)'}</p>
                        <div className="space-y-1.5">
                          {data.cats.map(c => (
                            <div key={c.name} className="flex items-center gap-2 text-sm">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                              <span className="text-slate-600 flex-1 truncate">{c.name}</span>
                              <span className="text-slate-700 font-medium">{fmt(c.amt)}</span>
                              <span className="text-slate-400 w-10 text-right">{c.pct}%</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">월 카드를 누르면 그 달 상세, ← 로 평균 복귀</p>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 연도별 개요(최근 3년) + 순수익 그래프 */}
              <div className="flex flex-wrap gap-2 items-stretch">
                {overview.slice(0, 3).map((o, i) => {
                  const prev = overview[i + 1]; const profit = o.revenue - o.hospital
                  const d = prev ? deltaPct(profit, prev.revenue - prev.hospital) : null
                  return (
                  <div key={o.key} className="card p-3 w-[calc(16.66%-0.5rem)] min-w-[140px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-semibold text-slate-700">{o.key}년</span>
                      {deltaBadge(d, '')}
                    </div>
                    <p className={`text-xl font-bold mb-1 ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{won(profit)}</p>
                    <div className="space-y-0.5 text-[15px]">
                      <div className="flex justify-between"><span className="text-slate-400">수입</span><span className="text-slate-600">{won(o.revenue)}</span></div>
                      <div className="flex justify-between"><span className="text-red-400">지출</span><span className="text-slate-600">{won(o.expense)}</span></div>
                      <div className="flex justify-between"><span className="text-rose-400">병원</span><span className="text-slate-600">{won(o.hospital)}</span></div>
                      <div className="flex justify-between"><span className="text-teal-500">가계</span><span className="text-slate-600">{won(o.household)}</span></div>
                      <div className="flex justify-between"><span className="text-amber-500">개인</span><span className="text-slate-600">{won(o.personal)}</span></div>
                      <div className="flex justify-between"><span className="text-indigo-500">저축</span><span className="text-slate-600">{won(o.saving)}</span></div>
                    </div>
                  </div>
                )})}
                <div className="card p-3 flex-1 min-w-[280px]">
                  <h3 className="font-semibold text-slate-800 mb-1 text-lg">📈 순수익 추이 (최근 3년, 매출−병원경비)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={profitChartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 10000)}만`} />
                      <Tooltip formatter={(v, n) => [`${Number(v).toLocaleString()}원`, `${n}년`]} itemSorter={(it) => -Number(it.name)} />
                      <Legend content={() => (
                        <div className="flex justify-center gap-4 mt-1">
                          {[...recentYears].reverse().map(y => (
                            <span key={y} className="inline-flex items-center gap-1 text-[13px] text-slate-600">
                              <span className="inline-block w-3.5 h-[3px] rounded" style={{ background: YEAR_COLORS[y] }} />{y}년
                            </span>
                          ))}
                        </div>
                      )} />
                      {[...recentYears].reverse().map(y => <Line key={y} type="monotone" dataKey={y} stroke={YEAR_COLORS[y]} strokeWidth={2} dot={{ r: 2 }} />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* 이전 연도 */}
              {olderYears.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {overview.slice(3).map((o, idx) => {
                    const prev = overview[idx + 4]; const profit = o.revenue - o.hospital
                    const d = prev ? deltaPct(profit, prev.revenue - prev.hospital) : null
                    return (
                    <div key={o.key} className="card p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg font-semibold text-slate-700">{o.key}년 {deltaBadge(d, '')}</span>
                        <span className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{won(profit)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-[15px]">
                        <div className="flex justify-between"><span className="text-slate-400">수입</span><span className="text-slate-600">{won(o.revenue)}</span></div>
                        <div className="flex justify-between"><span className="text-red-400">지출</span><span className="text-slate-600">{won(o.expense)}</span></div>
                        <div className="flex justify-between"><span className="text-rose-400">병원</span><span className="text-slate-600">{won(o.hospital)}</span></div>
                        <div className="flex justify-between"><span className="text-teal-500">가계</span><span className="text-slate-600">{won(o.household)}</span></div>
                        <div className="flex justify-between"><span className="text-amber-500">개인</span><span className="text-slate-600">{won(o.personal)}</span></div>
                        <div className="flex justify-between"><span className="text-indigo-500">저축</span><span className="text-slate-600">{won(o.saving)}</span></div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
              <p className="text-[10px] text-slate-400">단위 만원 · 선 그래프는 연도별 월 순수익(매출−병원경비)</p>
            </>
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
                  {/* 분류 (검색 + 목록 선택) */}
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
                  {/* 구분 */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">구분</label>
                    <div className="flex gap-2">
                      {scopeOptions.map(s => (
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
                  {/* 저축 */}
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setForm(f => ({ ...f, is_saving: !f.is_saving }))}>
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.is_saving ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_saving ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">저축 항목</p>
                  </label>
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
