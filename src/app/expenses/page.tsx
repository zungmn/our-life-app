'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Transaction } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

export default function ExpensesPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showModal, setShowModal] = useState(false)
  const [tab, setTab] = useState<'all' | 'expense' | 'income'>('all')
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'expense' as 'income' | 'expense',
    category: '직원',
    amount: '',
    memo: '',
    payment_method: '노출 현금',
  })
  const [loading, setLoading] = useState(false)

  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  const fetchTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })
    setTransactions(data || [])
  }, [currentDate])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const expenses = transactions.filter(t => t.type === 'expense')
  const incomes = transactions.filter(t => t.type === 'income')
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0)

  // Chart data: expenses by category
  const categoryTotals = EXPENSE_CATEGORIES.map(cat => {
    const total = expenses.filter(t => t.category === cat.value).reduce((s, t) => s + t.amount, 0)
    return { name: cat.label, value: total, color: cat.color }
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  const displayed = transactions.filter(t => tab === 'all' ? true : t.type === tab)

  const handleSave = async () => {
    if (!form.amount || !form.category) return
    setLoading(true)
    await supabase.from('transactions').insert({
      date: form.date,
      type: form.type,
      category: form.category,
      amount: parseInt(form.amount.replace(/,/g, '')),
      memo: form.memo || null,
      payment_method: form.payment_method || null,
    })
    await fetchTransactions()
    setShowModal(false)
    setForm(f => ({ ...f, amount: '', memo: '' }))
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id)
    await fetchTransactions()
  }

  const catColor = (category: string) => {
    return ALL_CATEGORIES.find(c => c.value === category)?.color || '#9CA3AF'
  }

  const formatAmt = (n: number) => n.toLocaleString() + '원'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-xl font-bold text-slate-800">
          {format(currentDate, 'yyyy년 M월')}
        </h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Summary cards */}
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
                {categoryTotals.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* List */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex gap-1">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === t ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={14} /> 추가
          </button>
        </div>

        {displayed.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">내역이 없어요</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayed.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor(t.category) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.category}</p>
                    {t.memo && <p className="text-xs text-slate-400 truncate">{t.memo}</p>}
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <p className="text-xs text-slate-400">{t.date}</p>
                    {t.payment_method && <p className="text-xs text-slate-300">{t.payment_method}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${t.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                    {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()}
                  </p>
                  <button onClick={() => handleDelete(t.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">내역 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              {/* Type */}
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        type,
                        category: type === 'expense' ? '직원' : '진료 수입'
                      }))
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.type === type
                        ? type === 'expense' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {type === 'expense' ? '지출' : '수입'}
                  </button>
                ))}
              </div>

              {/* Date */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">카테고리</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {form.type === 'expense' ? (
                    <>
                      <optgroup label="병원 경비">
                        {EXPENSE_CATEGORIES.filter(c => c.group === '병원 경비').map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="생활비">
                        {EXPENSE_CATEGORIES.filter(c => c.group === '생활비').map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    INCOME_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">금액 (원)</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>

              {/* Payment method */}
              {form.type === 'expense' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">결제 수단</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Memo */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="메모..."
                  value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
              </div>

              <button
                onClick={handleSave}
                disabled={loading || !form.amount}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
