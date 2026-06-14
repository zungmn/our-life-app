'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Event as CalendarEvent, Todo, Project } from '@/lib/supabase'
import { PERSON_COLORS } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, addMonths, subMonths, differenceInDays, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, X, Trash2, Check, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import DateInput from '@/components/DateInput'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const TODAY = format(new Date(), 'yyyy-MM-dd')

export default function Home() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [todos, setTodos] = useState<Todo[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calDate, setCalDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [showTodoModal, setShowTodoModal] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)

  const [todoForm, setTodoForm] = useState({ title: '', deadline: TODAY, shared: false })
  const [projectForm, setProjectForm] = useState({ title: '', shared: false })
  const [eventForm, setEventForm] = useState({ title: '', date: TODAY, time: '', person: 'both' as 'eddy' | 'judy' | 'both', note: '' })

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
  }, [])

  const switchViewer = (v: 'eddy' | 'judy') => {
    setViewer(v)
    localStorage.setItem('viewer', v)
    window.dispatchEvent(new CustomEvent('viewer-change'))
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

  const isVisible = (visibility: string) =>
    viewer === 'eddy' ? visibility === 'eddy' || visibility === 'both'
    : visibility === 'judy' || visibility === 'both'

  const visibleTodos = todos.filter(t => isVisible(t.visibility))
  const visibleProjects = projects.filter(p => isVisible(p.visibility) && p.status === 'in_progress')

  const daysLeft = (deadline: string) => {
    const d = differenceInDays(parseISO(deadline), new Date())
    if (d < 0) return { label: `${Math.abs(d)}일 초과`, color: 'text-red-500' }
    if (d === 0) return { label: '오늘 마감', color: 'text-red-500' }
    if (d === 1) return { label: '내일 마감', color: 'text-orange-500' }
    return { label: `D-${d}`, color: d <= 3 ? 'text-orange-500' : 'text-slate-400' }
  }

  const urgentTodos = visibleTodos.filter(t => !t.completed && t.deadline && differenceInDays(parseISO(t.deadline), new Date()) <= 7)
  const normalTodos = visibleTodos.filter(t => !t.completed && !(t.deadline && differenceInDays(parseISO(t.deadline), new Date()) <= 7))
  const completedTodos = visibleTodos.filter(t => t.completed)

  const ownerBadge = (owner: string) => ({
    label: owner === 'eddy' ? 'E' : 'J',
    cls: owner === 'eddy' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
  })

  const handleTodoSave = async () => {
    if (!todoForm.title.trim()) return
    const visibility = todoForm.shared ? 'both' : viewer
    const { error } = await supabase.from('todos').insert({ title: todoForm.title, deadline: todoForm.deadline || null, completed: false, visibility, owner: viewer })
    if (error) { alert('저장 실패: ' + error.message); return }
    setTodoForm({ title: '', deadline: TODAY, shared: false })
    setShowTodoModal(false)
    await fetchAll()
  }

  const handleTodoToggle = async (todo: Todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    await fetchAll()
  }

  const handleTodoDelete = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    await fetchAll()
  }

  const handleProjectSave = async () => {
    if (!projectForm.title.trim()) return
    const visibility = projectForm.shared ? 'both' : viewer
    const { error } = await supabase.from('projects').insert({ title: projectForm.title, status: 'in_progress', visibility })
    if (error) { alert('저장 실패: ' + error.message); return }
    setProjectForm({ title: '', shared: false })
    setShowProjectModal(false)
    await fetchAll()
  }

  const handleProjectComplete = async (project: Project) => {
    await supabase.from('projects').update({ status: project.status === 'in_progress' ? 'completed' : 'in_progress' }).eq('id', project.id)
    await fetchAll()
  }

  const handleProjectDelete = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id)
    await fetchAll()
  }

  const handleEventSave = async () => {
    if (!eventForm.title.trim()) return
    const { error } = await supabase.from('events').insert({ title: eventForm.title, date: eventForm.date, time: eventForm.time || null, person: eventForm.person, note: eventForm.note || null })
    if (error) { alert('저장 실패: ' + error.message); return }
    setEventForm({ title: '', date: selectedDate || TODAY, time: '', person: 'both', note: '' })
    setShowEventModal(false)
    await fetchAll()
  }

  const monthStart = startOfMonth(calDate)
  const monthEnd = endOfMonth(calDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)
  const dayEvents = (date: Date) => events.filter(e => e.date === format(date, 'yyyy-MM-dd'))
  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : []

  const openEventModal = (date?: string) => {
    setEventForm({ title: '', date: date || selectedDate || TODAY, time: '', person: 'both', note: '' })
    setShowEventModal(true)
  }

  return (
    <div className="p-6 md:p-10 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-base font-semibold text-slate-500">{format(new Date(), 'M월 d일 (EEEE)', { locale: ko })}</p>
          <h2 className="text-2xl font-bold text-slate-800">Eddy & Judy house 🏠</h2>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => switchViewer('eddy')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewer === 'eddy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            Eddy
          </button>
          <button onClick={() => switchViewer('judy')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewer === 'judy' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}>
            Judy
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Todo */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">📋 Todo</h3>
            <div className="flex items-center gap-2">
              <Link href="/todos" className="text-xs text-blue-500 hover:underline">전체보기</Link>
              <button onClick={() => { setTodoForm({ title: '', deadline: TODAY, shared: false }); setShowTodoModal(true) }}
                className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
                <Plus size={13} /> 추가
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {urgentTodos.map(todo => {
              const dl = daysLeft(todo.deadline!)
              const badge = ownerBadge(todo.owner || viewer)
              return (
                <div key={todo.id} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg group">
                  <button onClick={() => handleTodoToggle(todo)} className="w-5 h-5 rounded-full border-2 border-red-300 flex-shrink-0 hover:bg-red-200 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-slate-800 truncate">{todo.title}</p>
                      {todo.visibility === 'both' && <span className={`text-[9px] px-1 rounded font-bold flex-shrink-0 ${badge.cls}`}>{badge.label}</span>}
                    </div>
                    <div className="flex items-center gap-1"><AlertCircle size={10} className="text-red-400" /><p className={`text-[10px] font-medium ${dl.color}`}>{dl.label}</p></div>
                  </div>
                  <button onClick={() => handleTodoDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                </div>
              )
            })}
            {normalTodos.map(todo => {
              const badge = ownerBadge(todo.owner || viewer)
              return (
                <div key={todo.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg group">
                  <button onClick={() => handleTodoToggle(todo)} className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 hover:bg-slate-200 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-slate-800 truncate">{todo.title}</p>
                      {todo.visibility === 'both' && <span className={`text-[9px] px-1 rounded font-bold flex-shrink-0 ${badge.cls}`}>{badge.label}</span>}
                    </div>
                    {todo.deadline && <p className={`text-[10px] ${daysLeft(todo.deadline).color}`}>{daysLeft(todo.deadline).label} · {format(parseISO(todo.deadline), 'M/d')}</p>}
                  </div>
                  <button onClick={() => handleTodoDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                </div>
              )
            })}
            {completedTodos.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-slate-400 cursor-pointer py-1">완료 {completedTodos.length}개</summary>
                <div className="space-y-1 mt-1">
                  {completedTodos.map(todo => (
                    <div key={todo.id} className="flex items-center gap-2 p-2 group opacity-50">
                      <button onClick={() => handleTodoToggle(todo)} className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-white" /></button>
                      <p className="text-sm text-slate-500 line-through truncate flex-1">{todo.title}</p>
                      <button onClick={() => handleTodoDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {visibleTodos.filter(t => !t.completed).length === 0 && <p className="text-sm text-slate-400 text-center py-3">할 일이 없어요 🎉</p>}
          </div>
        </div>

        {/* Project */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">🗂️ Project</h3>
            <div className="flex items-center gap-2">
              <Link href="/projects" className="text-xs text-blue-500 hover:underline">전체보기</Link>
              <button onClick={() => { setProjectForm({ title: '', shared: false }); setShowProjectModal(true) }}
                className="flex items-center gap-1 bg-purple-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-purple-600 transition-colors">
                <Plus size={13} /> 추가
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {visibleProjects.length === 0 && <p className="text-xs text-slate-400 py-1">진행 중인 프로젝트가 없어요</p>}
            {visibleProjects.map(project => {
              const dl = project.deadline ? daysLeft(project.deadline) : null
              return (
                <div key={project.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg group">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{project.title}</p>
                    {dl && <p className={`text-[10px] ${dl.color}`}>{dl.label}</p>}
                  </div>
                  <Link href="/projects" className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-blue-500 transition-all flex-shrink-0">상세</Link>
                  <button onClick={() => handleProjectComplete(project)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full hover:bg-green-200 transition-all flex-shrink-0">
                    <Check size={10} /> 완료
                  </button>
                  <button onClick={() => handleProjectDelete(project.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <button onClick={() => setCalDate(subMonths(calDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft size={18} className="text-slate-600" /></button>
          <h3 className="font-semibold text-slate-800">{format(calDate, 'yyyy년 M월')}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => openEventModal()} className="flex items-center gap-1 bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              <Plus size={13} /> 추가
            </button>
            <button onClick={() => setCalDate(addMonths(calDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight size={18} className="text-slate-600" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} className="border-b border-r border-slate-50 min-h-[80px]" />)}
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
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${todayMark ? 'bg-blue-500 text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {de.slice(0, 3).map(event => {
                    const pc = PERSON_COLORS[event.person]
                    return <div key={event.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${pc.bg} ${pc.text}`}>{event.title}</div>
                  })}
                  {de.length > 3 && <div className="text-[10px] text-slate-400 px-1">+{de.length - 3}</div>}
                </div>
              </div>
            )
          })}
        </div>

        {selectedDate && (
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">{format(new Date(selectedDate), 'M월 d일 (EEEE)', { locale: ko })}</p>
              <button onClick={() => openEventModal(selectedDate)}
                className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg transition-colors">
                <Plus size={12} /> 이날 일정 추가
              </button>
            </div>
            {selectedEvents.length === 0 ? <p className="text-xs text-slate-400">일정이 없어요</p> : (
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

        <div className="flex gap-4 px-4 py-2 border-t border-slate-50">
          {Object.entries(PERSON_COLORS).map(([key, pc]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: pc.dot }} />
              <span className="text-xs text-slate-400">{pc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Todo 모달 */}
      {showTodoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Todo 추가</h3>
              <button onClick={() => setShowTodoModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="할 일 입력" value={todoForm.title}
                onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">마감일</label>
                <DateInput value={todoForm.deadline} onChange={v => setTodoForm(f => ({ ...f, deadline: v }))} className="w-full" />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${todoForm.shared ? 'bg-blue-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${todoForm.shared ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">함께 보기</p>
                  <p className="text-xs text-slate-400">{todoForm.shared ? 'Eddy & Judy 모두 볼 수 있음' : `${viewer === 'eddy' ? 'Eddy' : 'Judy'}만 볼 수 있음`}</p>
                </div>
                <input type="checkbox" className="hidden" checked={todoForm.shared} onChange={e => setTodoForm(f => ({ ...f, shared: e.target.checked }))} />
              </label>
              <button onClick={handleTodoSave} disabled={!todoForm.title.trim()}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Project 모달 */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Project 추가</h3>
              <button onClick={() => setShowProjectModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                placeholder="프로젝트명" value={projectForm.title}
                onChange={e => setProjectForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${projectForm.shared ? 'bg-purple-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${projectForm.shared ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">함께 보기</p>
                  <p className="text-xs text-slate-400">{projectForm.shared ? 'Eddy & Judy 모두 볼 수 있음' : `${viewer === 'eddy' ? 'Eddy' : 'Judy'}만 볼 수 있음`}</p>
                </div>
                <input type="checkbox" className="hidden" checked={projectForm.shared} onChange={e => setProjectForm(f => ({ ...f, shared: e.target.checked }))} />
              </label>
              <button onClick={handleProjectSave} disabled={!projectForm.title.trim()}
                className="w-full bg-purple-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가 모달 */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">일정 추가</h3>
              <button onClick={() => setShowEventModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                placeholder="일정 제목" value={eventForm.title}
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                  <DateInput value={eventForm.date} onChange={v => setEventForm(f => ({ ...f, date: v }))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">시간 (선택)</label>
                  <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                    value={eventForm.time} onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">누구의 일정?</label>
                <div className="flex gap-2">
                  {[{ v: 'eddy', label: 'Eddy', cls: 'bg-blue-50 border-blue-300 text-blue-600' },
                    { v: 'judy', label: 'Judy', cls: 'bg-pink-50 border-pink-300 text-pink-600' },
                    { v: 'both', label: '함께', cls: 'bg-purple-50 border-purple-300 text-purple-600' }].map(opt => (
                    <button key={opt.v} onClick={() => setEventForm(f => ({ ...f, person: opt.v as 'eddy' | 'judy' | 'both' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${eventForm.person === opt.v ? opt.cls : 'border-slate-200 text-slate-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleEventSave} disabled={!eventForm.title.trim()}
                className="w-full bg-slate-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
