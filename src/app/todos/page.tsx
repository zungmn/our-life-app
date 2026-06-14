'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Todo } from '@/lib/supabase'
import { format, differenceInDays, parseISO } from 'date-fns'
import { Plus, X, Trash2, Check, AlertCircle } from 'lucide-react'
import DateInput from '@/components/DateInput'

export default function TodosPage() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [todos, setTodos] = useState<Todo[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', deadline: format(new Date(), 'yyyy-MM-dd'), shared: false })

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
  }, [])

  const fetchTodos = useCallback(async () => {
    const { data } = await supabase.from('todos').select('*').order('deadline', { ascending: true, nullsFirst: false })
    setTodos(data || [])
  }, [])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  const isVisible = (visibility: string) => {
    if (viewer === 'eddy') return visibility === 'eddy' || visibility === 'both'
    return visibility === 'judy' || visibility === 'both'
  }

  const visibleTodos = todos.filter(t => isVisible(t.visibility))
  const activeTodos = visibleTodos.filter(t => !t.completed)
  const completedTodos = visibleTodos.filter(t => t.completed)

  const daysLeft = (deadline: string) => {
    const d = differenceInDays(parseISO(deadline), new Date())
    if (d < 0) return { label: `${Math.abs(d)}일 초과`, color: 'text-red-500', urgent: true }
    if (d === 0) return { label: '오늘 마감', color: 'text-red-500', urgent: true }
    if (d <= 7) return { label: `D-${d}`, color: d <= 3 ? 'text-orange-500' : 'text-yellow-600', urgent: true }
    return { label: `D-${d}`, color: 'text-slate-400', urgent: false }
  }

  const ownerBadge = (owner: string) => ({
    label: owner === 'eddy' ? 'Eddy' : 'Judy',
    cls: owner === 'eddy' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
  })

  const handleSave = async () => {
    if (!form.title.trim()) return
    const { error } = await supabase.from('todos').insert({
      title: form.title,
      deadline: form.deadline || null,
      completed: false,
      visibility: form.shared ? 'both' : viewer,
      owner: viewer,
    })
    if (error) { alert('저장 실패: ' + error.message); return }
    setForm({ title: '', deadline: format(new Date(), 'yyyy-MM-dd'), shared: false })
    setShowModal(false)
    fetchTodos()
  }

  const handleToggle = async (todo: Todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    fetchTodos()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    fetchTodos()
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📋 Todo</h2>
          <p className="text-xs text-slate-400 mt-0.5">{viewer === 'eddy' ? 'Eddy' : 'Judy'} 화면</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors">
          <Plus size={16} /> 추가
        </button>
      </div>

      {/* Active */}
      <div className="space-y-2 mb-6">
        {activeTodos.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm">할 일이 없어요!</p>
          </div>
        )}
        {activeTodos.map(todo => {
          const dl = todo.deadline ? daysLeft(todo.deadline) : null
          const badge = ownerBadge(todo.owner || 'eddy')
          return (
            <div key={todo.id} className={`card p-3 flex items-center gap-3 group ${dl?.urgent ? 'border border-red-100' : ''}`}>
              <button onClick={() => handleToggle(todo)}
                className="w-6 h-6 rounded-full border-2 border-slate-300 flex-shrink-0 hover:bg-slate-100 transition-colors flex items-center justify-center">
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-800">{todo.title}</p>
                  {todo.visibility === 'both' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {dl && (
                    <div className="flex items-center gap-1">
                      {dl.urgent && <AlertCircle size={10} className="text-red-400" />}
                      <p className={`text-[11px] font-medium ${dl.color}`}>{dl.label}</p>
                    </div>
                  )}
                  {todo.deadline && (
                    <p className="text-[11px] text-slate-400">{format(parseISO(todo.deadline), 'yyyy.M.d')}</p>
                  )}
                </div>
              </div>
              <button onClick={() => handleDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Completed */}
      {completedTodos.length > 0 && (
        <details>
          <summary className="text-sm font-medium text-slate-400 cursor-pointer mb-2">완료됨 ({completedTodos.length})</summary>
          <div className="space-y-2 mt-2">
            {completedTodos.map(todo => (
              <div key={todo.id} className="card p-3 flex items-center gap-3 group opacity-50">
                <button onClick={() => handleToggle(todo)}
                  className="w-6 h-6 rounded-full bg-slate-300 flex-shrink-0 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </button>
                <p className="text-sm text-slate-500 line-through flex-1">{todo.title}</p>
                <button onClick={() => handleDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Todo 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="할 일 입력" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">데드라인 (선택)</label>
                <DateInput value={form.deadline} onChange={v => setForm(f => ({ ...f, deadline: v }))} className="w-full" />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.shared ? 'bg-blue-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.shared ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">함께 보기</p>
                  <p className="text-xs text-slate-400">{form.shared ? 'Eddy & Judy 모두 볼 수 있음' : `${viewer === 'eddy' ? 'Eddy' : 'Judy'}만 볼 수 있음`}</p>
                </div>
                <input type="checkbox" className="hidden" checked={form.shared} onChange={e => setForm(f => ({ ...f, shared: e.target.checked }))} />
              </label>
              <button onClick={handleSave} disabled={!form.title.trim()}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
