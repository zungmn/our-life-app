'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Event, Todo, Project } from '@/lib/supabase'
import { PERSON_COLORS } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, addMonths, subMonths, differenceInDays, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, X, Trash2, Check, ChevronLeft, ChevronRight, AlertCircle, Lock } from 'lucide-react'
import Link from 'next/link'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function Home() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [todos, setTodos] = useState<Todo[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [calDate, setCalDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showTodoModal, setShowTodoModal] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [todoForm, setTodoForm] = useState({ title: '', deadline: '', visibility: 'both' as 'eddy' | 'both' })
  const [projectForm, setProjectForm] = useState({ title: '', visibility: 'both' as 'eddy' | 'both' })
  const today = format(new Date(), 'yyyy-MM-dd')

  // 뷰어 로컬스토리지 저장
  useEffect(() => {
    const saved = localStorage.getItem('viewer') as 'eddy' | 'judy' | null
    if (saved) setViewer(saved)
  }, [])
  const switchViewer = (v: 'eddy' | 'judy') => {
    setViewer(v)
    localStorage.setItem('viewer', v)
  }

  const fetchAll = useCallback(async () => {
    const monthStart = format(startOfMonth(calDate), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(calDate), 'yyyy-MM-dd')
    const [todosRes, projectsRes, eventsRes] = await Promise.all([
      supabase.from('todos').select('*').order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: true }),
      supabase.from('events').select('*').gte('date', monthStart).lte('date', monthEnd),
    ])
    setTodos(todosRes.data || [])
    setProjects(projectsRes.data || [])
    setEvents(eventsRes.data || [])
  }, [calDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  // 보이기 필터
  const visibleTodos = todos.filter(t => t.visibility === 'both' || viewer === 'eddy')
  const visibleProjects = projects.filter(p => p.visibility === 'both' || viewer === 'eddy')

  // 1주일 이내 데드라인
  const urgentTodos = visibleTodos.filter(t =>
    !t.completed && t.deadline && differenceInDays(parseISO(t.deadline), new Date()) <= 7
  )
  const normalTodos = visibleTodos.filter(t =>
    !t.completed && !(t.deadline && differenceInDays(parseISO(t.deadline), new Date()) <= 7)
  )
  const completedTodos = visibleTodos.filter(t => t.completed)

  const daysLeft = (deadline: string) => {
    const d = differenceInDays(parseISO(deadline), new Date())
    if (d < 0) return { label: `${Math.abs(d)}일 초과`, color: 'text-red-500' }
    if (d === 0) return { label: '오늘 마감', color: 'text-red-500' }
    if (d === 1) return { label: '내일 마감', color: 'text-orange-500' }
    return { label: `D-${d}`, color: d <= 3 ? 'text-orange-500' : 'text-slate-400' }
  }

  const handleTodoSave = async () => {
    if (!todoForm.title.trim()) return
    await supabase.from('todos').insert({
      title: todoForm.title,
      deadline: todoForm.deadline || null,
      completed: false,
      visibility: todoForm.visibility,
    })
    setTodoForm({ title: '', deadline: '', visibility: 'both' })
    setShowTodoModal(false)
    fetchAll()
  }

  const handleTodoToggle = async (todo: Todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    fetchAll()
  }

  const handleTodoDelete = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    fetchAll()
  }

  const handleProjectSave = async () => {
    if (!projectForm.title.trim()) return
    await supabase.from('projects').insert({
      title: projectForm.title,
      status: 'in_progress',
      visibility: projectForm.visibility,
    })
    setProjectForm({ title: '', visibility: 'both' })
    setShowProjectModal(false)
    fetchAll()
  }

  const handleProjectComplete = async (project: Project) => {
    const newStatus = project.status === 'in_progress' ? 'completed' : 'in_progress'
    await supabase.from('projects').update({ status: newStatus }).eq('id', project.id)
    fetchAll()
  }

  const handleProjectDelete = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id)
    fetchAll()
  }

  // 캘린더
  const monthStart = startOfMonth(calDate)
  const monthEnd = endOfMonth(calDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)
  const dayEvents = (date: Date) => events.filter(e => e.date === format(date, 'yyyy-MM-dd'))
  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : []

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* 헤더 + 뷰어 전환 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-slate-400">{format(new Date(), 'M월 d일 (EEEE)', { locale: ko })}</p>
          <h2 className="text-2xl font-bold text-slate-800">잘했어, 잘하고 있어 ✨</h2>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => switchViewer('eddy')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewer === 'eddy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            Eddy
          </button>
          <button
            onClick={() => switchViewer('judy')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewer === 'judy' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}
          >
            Judy
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">

        {/* Todo List */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">📋 Todo List</h3>
            <button onClick={() => setShowTodoModal(true)}
              className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
              <Plus size={13} /> 추가
            </button>
          </div>

          <div className="space-y-1">
            {/* 긴급 (1주일 이내) */}
            {urgentTodos.map(todo => {
              const dl = daysLeft(todo.deadline!)
              return (
                <div key={todo.id} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg group">
                  <button onClick={() => handleTodoToggle(todo)}
                    className="w-5 h-5 rounded-full border-2 border-red-300 flex items-center justify-center flex-shrink-0 hover:bg-red-200 transition-colors">
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{todo.title}</p>
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={10} className="text-red-400" />
                      <p className={`text-[10px] font-medium ${dl.color}`}>{dl.label}</p>
                      {todo.visibility === 'eddy' && <Lock size={9} className="text-slate-300" />}
                    </div>
                  </div>
                  <button onClick={() => handleTodoDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}

            {/* 일반 */}
            {normalTodos.map(todo => (
              <div key={todo.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg group">
                <button onClick={() => handleTodoToggle(todo)}
                  className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0 hover:bg-slate-200 transition-colors">
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{todo.title}</p>
                  {todo.deadline && (
                    <p className={`text-[10px] ${daysLeft(todo.deadline).color}`}>
                      {daysLeft(todo.deadline).label} · {format(parseISO(todo.deadline), 'M/d')}
                    </p>
                  )}
                </div>
                {todo.visibility === 'eddy' && <Lock size={10} className="text-slate-300 flex-shrink-0" />}
                <button onClick={() => handleTodoDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* 완료 */}
            {completedTodos.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-slate-400 cursor-pointer py-1">완료 {completedTodos.length}개</summary>
                <div className="space-y-1 mt-1">
                  {completedTodos.map(todo => (
                    <div key={todo.id} className="flex items-center gap-2 p-2 group opacity-50">
                      <button onClick={() => handleTodoToggle(todo)}
                        className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0">
                        <Check size={10} className="text-white" />
                      </button>
                      <p className="text-sm text-slate-500 line-through truncate flex-1">{todo.title}</p>
                      <button onClick={() => handleTodoDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {visibleTodos.filter(t => !t.completed).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3">할 일이 없어요 🎉</p>
            )}
          </div>
        </div>

        {/* 일정 상황판 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">🗂️ 일정 상황판</h3>
            <button onClick={() => setShowProjectModal(true)}
              className="flex items-center gap-1 bg-purple-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-purple-600 transition-colors">
              <Plus size={13} /> 추가
            </button>
          </div>

          <div className="space-y-2">
            {/* 진행 중 */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">진행중</p>
              {visibleProjects.filter(p => p.status === 'in_progress').length === 0 && (
                <p className="text-xs text-slate-400 py-1">진행 중인 프로젝트가 없어요</p>
              )}
              {visibleProjects.filter(p => p.status === 'in_progress').map(project => (
                <div key={project.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg group">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <p className="text-sm text-slate-800 flex-1 truncate">{project.title}</p>
                  {project.visibility === 'eddy' && <Lock size={10} className="text-slate-300 flex-shrink-0" />}
                  <button
                    onClick={() => handleProjectComplete(project)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full hover:bg-green-200 transition-all flex-shrink-0"
                  >
                    <Check size={10} /> 완료
                  </button>
                  <button onClick={() => handleProjectDelete(project.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* 완료 */}
            {visibleProjects.filter(p => p.status === 'completed').length > 0 && (
              <details>
                <summary className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide cursor-pointer py-1">
                  완료 {visibleProjects.filter(p => p.status === 'completed').length}개
                </summary>
                <div className="space-y-1 mt-1">
                  {visibleProjects.filter(p => p.status === 'completed').map(project => (
                    <div key={project.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg group opacity-60">
                      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <p className="text-sm text-slate-500 line-through flex-1 truncate">{project.title}</p>
                      <button
                        onClick={() => handleProjectComplete(project)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-blue-500 transition-all flex-shrink-0"
                      >
                        되돌리기
                      </button>
                      <button onClick={() => handleProjectDelete(project.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* 캘린더 */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <button onClick={() => setCalDate(subMonths(calDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <h3 className="font-semibold text-slate-800">{format(calDate, 'yyyy년 M월')}</h3>
          <button onClick={() => setCalDate(addMonths(calDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array(startPad).fill(null).map((_, i) => (
            <div key={`pad-${i}`} className="border-b border-r border-slate-50 min-h-[80px]" />
          ))}
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const de = dayEvents(day)
            const isSelected = selectedDate === dateStr
            const todayMark = isToday(day)
            const dow = getDay(day)
            const isLastRow = i >= days.length - 7
            return (
              <div key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`border-b border-r border-slate-50 min-h-[80px] p-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : ''} ${isLastRow ? 'border-b-0' : ''}`}>
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  todayMark ? 'bg-blue-500 text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-700'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {de.slice(0, 3).map(event => {
                    const pc = PERSON_COLORS[event.person]
                    return (
                      <div key={event.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${pc.bg} ${pc.text}`}>
                        {event.title}
                      </div>
                    )
                  })}
                  {de.length > 3 && <div className="text-[10px] text-slate-400 px-1">+{de.length - 3}</div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* 선택된 날 일정 + 추가 버튼 */}
        {selectedDate && (
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">
                {format(new Date(selectedDate), 'M월 d일 (EEEE)', { locale: ko })}
              </p>
              <Link href="/calendar" className="text-xs text-blue-500 hover:underline">
                캘린더에서 추가 →
              </Link>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-slate-400">일정이 없어요</p>
            ) : (
              <div className="space-y-1">
                {selectedEvents.map(event => {
                  const pc = PERSON_COLORS[event.person]
                  return (
                    <div key={event.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${pc.bg}`}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: pc.dot }} />
                      <p className={`text-sm ${pc.text}`}>{event.title}</p>
                      {event.time && <p className="text-xs text-slate-400 ml-auto">{event.time}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 범례 */}
        <div className="flex gap-4 px-4 py-2 border-t border-slate-50">
          {Object.entries(PERSON_COLORS).map(([key, pc]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: pc.dot }} />
              <span className="text-xs text-slate-400">{pc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Todo 추가 모달 */}
      {showTodoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">할 일 추가</h3>
              <button onClick={() => setShowTodoModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="할 일 입력" value={todoForm.title}
                onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">데드라인 (선택)</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={todoForm.deadline} onChange={e => setTodoForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">공개 범위</label>
                <div className="flex gap-2">
                  {[{ v: 'both', label: '🔓 함께 보기' }, { v: 'eddy', label: '🔒 Eddy만' }].map(opt => (
                    <button key={opt.v} onClick={() => setTodoForm(f => ({ ...f, visibility: opt.v as 'eddy' | 'both' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        todoForm.visibility === opt.v ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-slate-200 text-slate-500'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleTodoSave} disabled={!todoForm.title.trim()}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로젝트 추가 모달 */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">프로젝트 추가</h3>
              <button onClick={() => setShowProjectModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                placeholder="프로젝트명 입력" value={projectForm.title}
                onChange={e => setProjectForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">공개 범위</label>
                <div className="flex gap-2">
                  {[{ v: 'both', label: '🔓 함께 보기' }, { v: 'eddy', label: '🔒 Eddy만' }].map(opt => (
                    <button key={opt.v} onClick={() => setProjectForm(f => ({ ...f, visibility: opt.v as 'eddy' | 'both' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        projectForm.visibility === opt.v ? 'bg-purple-50 border-purple-300 text-purple-600' : 'border-slate-200 text-slate-500'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleProjectSave} disabled={!projectForm.title.trim()}
                className="w-full bg-purple-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
