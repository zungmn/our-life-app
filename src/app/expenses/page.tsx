'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Transaction } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, getDay, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import DateInput from '@/components/DateInput'

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const toNum = (s: string) => parseInt(s.replace(/,/g, '') || '0', 10)
const toComma = (s: string) => {
  const n = s.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString() : ''
}

export default function ExpensesPage() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Transaction | null>(null)
  const [tab, setTab] = useState<'list' | 'calendar'>('calendar')
  const [listTab, setListTab] = useState<'all' | 'expense' | 'income'>('all')
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'expense' as 'income' | 'expense',
    category: '직원',
    amount: '',
    memo: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
    const handler = () => setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
    window.addEventListener('viewer-change', handler)
    return () => window.removeEventListener('viewer-change', handler)
  }, [])

  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  const fetchTransactions = useCallback(async () => {
    const v = (localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy'
    const { data } = await supabase.from('transactions').select('*')
      .gte('date', monthStart).lte('date', monthEnd)
      .or(`owner.eq.${v},owner.is.null`)
      .order('date', { ascending: false })
    setTransactions(data || [])
  }, [currentDate, viewer])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const openAdd = () => {
    setEditItem(null)
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), type: 'expense', category: '직원', amount: '', memo: '' })
    setShowModal(true)
  }

  const openEdit = (t: Transaction) => {
    setEditItem(t)
    setForm({ date: t.date, type: t.type, category: t.category, amount: t.amount.toLocaleString(), memo: t.memo || '' })
    setShowModal(true)
  }

  const expenses = transactions.filter(t => t.type === 'expense')
  const incomes = transactions.filter(t => t.type === 'income')
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0)

  const categoryTotals = EXPENSE_CATEGORIES.map(cat => {
    const total = expenses.filter(t => t.category === cat.value).reduce((s, t) => s + t.amount, 0)
    return { name: cat.label, value: total, color: cat.color }
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  const displayed = listTab === 'all' ? transactions : transactions.filter(t => t.type === listTab)

  const handleSave = async () => {
    if (!form.amount || !form.category) return
    setLoading(true)
    const amount = toNum(form.amount)
    if (editItem) {
      const { error } = await supabase.from('transactions').update({
        date: form.date, type: form.type, category: form.category, amount, memo: form.memo || null,
      }).eq('id', editItem.id)
      if (error) { alert('수정 실패: ' + error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.from('transactions').insert({
        date: form.date, type: form.type, category: form.category, amount, memo: form.memo || null, owner: viewer,
      })
      if (error) { alert('저장 실패: ' + error.message); setLoading(false); return }
    }
    await fetchTransactions()
    setShowModal(false)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id)
    await fetchTransactions()
  }

  const catColor = (category: string) => ALL_CATEGORIES.find(c => c.value === category)?.color || '#9CA3AF'
  const formatAmt = (n: number) => n.toLocaleString() + '원'

  // Calendar view data
  const calStart = startOfMonth(currentDate)
  const calEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const startPad = getDay(calStart)
  const dayTotals = (date: Date) => {
    const ds = format(date, 'yyyy-MM-dd')
    const dayTs = transactions.filter(t => t.date === ds)
    const exp = dayTs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const inc = dayTs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    return { exp, inc, count: dayTs.length }
  }

  return (
    <div className="p-6 md:p-10 max-w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">💰 가계부</h2>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => { setViewer('eddy'); localStorage.setItem('viewer', 'eddy'); window.dispatchEvent(new CustomEvent('viewer-change')) }}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${viewer === 'eddy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Eddy</button>
          <button onClick={() => { setViewer('judy'); localStorage.setItem('viewer', 'judy'); window.dispatchEvent(new CustomEvent('viewer-change')) }}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${viewer === 'judy' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}>Judy</button>
        </div>
      </div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-lg font-semibold text-slate-700">{format(currentDate, 'yyyy년 M월')}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-3">
          <p className="text-xs text-slate-400 mb-1">지출</p>
          <p className="text-lg font-bold text-red-500">{formatAmt(totalExpense)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-400 mb-1">수입</p>
          <p className="text-lg font-bold text-green-500">{formatAmt(totalIncome)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-400 mb-1">잔액</p>
          <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
            {formatAmt(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      {/* Chart */}
      {categoryTotals.length > 0 && (
        <div className="card p-4 mb-5">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">카테고리별 지출</h3>
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

      {/* View tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {[{ k: 'calendar', l: '캘린더' }, { k: 'list', l: '목록' }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.k ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t.l}
            </button>
          ))}
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
          <Plus size={14} /> 추가
        </button>
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
                  <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar view */}
      {tab === 'calendar' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-2.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array(startPad).fill(null).map((_, i) => (
              <div key={`pad-${i}`} className="border-b border-r border-slate-50 min-h-[110px]" />
            ))}
            {days.map((day, i) => {
              const ds = format(day, 'yyyy-MM-dd')
              const dayTs = transactions.filter(t => t.date === ds)
              const dow = getDay(day)
              const isLastRow = i >= days.length - 7
              return (
                <div key={ds}
                  className={`border-b border-r border-slate-50 min-h-[110px] p-1 ${isLastRow ? 'border-b-0' : ''}`}>
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday(day) ? 'bg-blue-500 text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-700'
                  }`}>{format(day, 'd')}</div>
                  <div className="space-y-0.5">
                    {dayTs.slice(0, 5).map(t => (
                      <div key={t.id} onDoubleClick={() => openEdit(t)}
                        className={`text-[11px] px-1 py-0.5 rounded truncate cursor-pointer ${t.type === 'expense' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {t.category} {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()}
                      </div>
                    ))}
                    {dayTs.length > 5 && <div className="text-[10px] text-slate-400 px-1">+{dayTs.length - 5}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editItem ? '내역 수정' : '내역 추가'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map(type => (
                  <button key={type} onClick={() => setForm(f => ({ ...f, type, category: type === 'expense' ? '직원' : '진료 수입' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.type === type
                        ? type === 'expense' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'
                        : 'border-slate-200 text-slate-500'
                    }`}>
                    {type === 'expense' ? '지출' : '수입'}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <DateInput value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">카테고리</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {form.type === 'expense' ? (
                    <>
                      <optgroup label="병원 경비">
                        {EXPENSE_CATEGORIES.filter(c => c.group === '병원 경비').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </optgroup>
                      <optgroup label="생활비">
                        {EXPENSE_CATEGORIES.filter(c => c.group === '생활비').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </optgroup>
                    </>
                  ) : INCOME_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">금액 (원)</label>
                <input type="text" inputMode="numeric"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: toComma(e.target.value) }))} />
                {form.amount && <p className="text-xs text-slate-400 mt-1">{toNum(form.amount).toLocaleString()}원</p>}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="메모..." value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
              <button onClick={handleSave} disabled={loading || !form.amount}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
                {loading ? '저장 중...' : editItem ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
