'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Event as CalendarEvent, Todo, Project } from '@/lib/supabase'
import { PERSON_COLORS } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, getDay, isToday, addMonths, subMonths, differenceInCalendarDays, parseISO, addDays, subDays, isSameMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, X, Trash2, Check, ChevronLeft, ChevronRight, Paperclip, Download } from 'lucide-react'
import Link from 'next/link'
import DatePickerInput from '@/components/DatePickerInput'
import { holidaysForYears } from '@/lib/holidays'
import { ProjectDetailModal, ProjectAddModal } from '@/components/ProjectModals'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']
const TODAY = format(new Date(), 'yyyy-MM-dd')
const PERSON_ORDER: Record<string, number> = { both: 0, eddy: 1, judy: 2 }

function sortEvents(evs: CalendarEvent[]) {
  const span = (e: CalendarEvent) => (e.end_date && e.end_date !== e.date ? 1 : 0)
  return [...evs].sort((a, b) => {
    // 여러 날 이어지는 일정을 항상 위로 (끊김 없이 표시)
    if (span(a) !== span(b)) return span(b) - span(a)
    if (span(a) && span(b)) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return a.id < b.id ? -1 : 1
    }
    const aNo = a.time ? 1 : 0
    const bNo = b.time ? 1 : 0
    if (aNo !== bNo) return aNo - bNo
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time)
    return (PERSON_ORDER[a.person] ?? 1) - (PERSON_ORDER[b.person] ?? 1)
  })
}

function formatKoreanTime(time?: string) {
  if (!time) return ''
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const period = h < 12 ? '오전' : '오후'
  const hourDisplay = h < 12 ? h : (h === 12 ? 12 : h - 12)
  return `${period} ${hourDisplay}시 ${String(m).padStart(2, '0')}분`
}

export default function Home() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [todos, setTodos] = useState<Todo[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calDate, setCalDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [uploadingEventFile, setUploadingEventFile] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const downloadPhoto = async (url: string) => {
    try {
      const r = await fetch(url); const b = await r.blob()
      const o = URL.createObjectURL(b); const a = document.createElement('a')
      a.href = o; a.download = url.split('/').pop()?.split('?')[0] || 'photo'
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(o)
    } catch { window.open(url, '_blank') }
  }

  // Add modals
  const [showTodoModal, setShowTodoModal] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)

  // Edit state
  const [editTodo, setEditTodo] = useState<Todo | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)

  const [todoForm, setTodoForm] = useState({ title: '', deadline: TODAY, shared: false })
  const [eventForm, setEventForm] = useState({ title: '', date: TODAY, end_date: '', time: '', person: 'both' as 'eddy' | 'judy' | 'both', note: '', photos: [] as string[] })

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
  }, [])

  const switchViewer = (v: 'eddy' | 'judy') => {
    setViewer(v)
    localStorage.setItem('viewer', v)
    window.dispatchEvent(new CustomEvent('viewer-change'))
  }

  const fetchAll = useCallback(async () => {
    // 캘린더 그리드(전/다음 달 포함) 범위로 일정 로드
    const ms = startOfMonth(calDate)
    const gs = subDays(ms, (getDay(ms) + 6) % 7)
    const ge = addDays(gs, 41)
    const [todosRes, projectsRes, eventsRes] = await Promise.all([
      supabase.from('todos').select('*').order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: true }),
      supabase.from('events').select('*').gte('date', format(gs, 'yyyy-MM-dd')).lte('date', format(ge, 'yyyy-MM-dd')),
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
    const d = differenceInCalendarDays(parseISO(deadline), new Date())
    if (d < 0) return { label: `${Math.abs(d)}일 초과`, color: 'text-red-500' }
    if (d === 0) return { label: '오늘 마감', color: 'text-red-500' }
    return { label: `D-${d}`, color: d <= 3 ? 'text-orange-500' : 'text-slate-400' }
  }

  // Home: show only past + D-6 (daysLeft <= 6)
  const homeTodos = visibleTodos.filter(t => {
    if (t.completed) return false
    if (!t.deadline) return true
    return differenceInCalendarDays(parseISO(t.deadline), new Date()) <= 6
  })

  const ownerBadge = (owner: string) => ({
    label: owner === 'eddy' ? 'E' : 'J',
    cls: owner === 'eddy' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
  })

  // --- Todo handlers ---
  const openAddTodo = () => {
    setEditTodo(null)
    setTodoForm({ title: '', deadline: TODAY, shared: false })
    setShowTodoModal(true)
  }
  const openEditTodo = (todo: Todo) => {
    setEditTodo(todo)
    setTodoForm({ title: todo.title, deadline: todo.deadline || TODAY, shared: todo.visibility === 'both' })
    setShowTodoModal(true)
  }
  const handleTodoSave = async () => {
    if (!todoForm.title.trim()) return
    const visibility = todoForm.shared ? 'both' : viewer
    if (editTodo) {
      const { error } = await supabase.from('todos').update({ title: todoForm.title, deadline: todoForm.deadline || null, visibility }).eq('id', editTodo.id)
      if (error) { alert('수정 실패: ' + error.message); return }
    } else {
      const { error } = await supabase.from('todos').insert({ title: todoForm.title, deadline: todoForm.deadline || null, completed: false, visibility, owner: viewer })
      if (error) { alert('저장 실패: ' + error.message); return }
    }
    setTodoForm({ title: '', deadline: TODAY, shared: false })
    setEditTodo(null)
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

  // --- Project handlers ---
  const openAddProject = () => setShowProjectModal(true)
  const handleProjectComplete = async (project: Project) => {
    await supabase.from('projects').update({ status: project.status === 'in_progress' ? 'completed' : 'in_progress' }).eq('id', project.id)
    await fetchAll()
  }
  const handleProjectDelete = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id)
    await fetchAll()
  }

  // --- Event handlers ---
  const openAddEvent = (date?: string) => {
    setEditEvent(null)
    setEventForm({ title: '', date: date || selectedDate || TODAY, end_date: '', time: '', person: 'both', note: '', photos: [] })
    setShowEventModal(true)
  }
  const openEditEvent = (event: CalendarEvent) => {
    setEditEvent(event)
    setEventForm({ title: event.title, date: event.date, end_date: event.end_date || '', time: event.time || '', person: event.person, note: event.note || '', photos: event.photos || [] })
    setShowEventModal(true)
  }
  const handleEventSave = async () => {
    if (!eventForm.title.trim()) return
    const payload = { title: eventForm.title, date: eventForm.date, end_date: eventForm.end_date || null, time: eventForm.time || null, person: eventForm.person, note: eventForm.note || null, photos: eventForm.photos }
    if (editEvent) {
      const { error } = await supabase.from('events').update(payload).eq('id', editEvent.id)
      if (error) { alert('수정 실패: ' + error.message); return }
    } else {
      const { error } = await supabase.from('events').insert(payload)
      if (error) { alert('저장 실패: ' + error.message); return }
    }
    setEventForm({ title: '', date: selectedDate || TODAY, end_date: '', time: '', person: 'both', note: '', photos: [] })
    setEditEvent(null)
    setShowEventModal(false)
    await fetchAll()
  }
  const handleEventDelete = async (id: string) => {
    await supabase.from('events').delete().eq('id', id)
    await fetchAll()
  }
  // 사진 여러 장 업로드 → eventForm.photos 에 URL 추가
  const handleEventPhotos = async (files: FileList) => {
    setUploadingEventFile(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `events/photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error } = await supabase.storage.from('archive').upload(path, file, { upsert: true })
      if (error) { alert('업로드 실패: ' + error.message); continue }
      urls.push(supabase.storage.from('archive').getPublicUrl(path).data.publicUrl)
    }
    setEventForm(f => ({ ...f, photos: [...f.photos, ...urls] }))
    setUploadingEventFile(false)
  }
  const handleEventFileUpload = async (file: File, eventId: string) => {
    setUploadingEventFile(true)
    const ext = file.name.split('.').pop()
    const path = `events/${eventId}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('archive').upload(path, file, { upsert: true })
    if (error) { alert('업로드 실패: ' + error.message); setUploadingEventFile(false); return }
    const { data } = supabase.storage.from('archive').getPublicUrl(path)
    await supabase.from('events').update({ file_url: data.publicUrl }).eq('id', eventId)
    await fetchAll()
    setUploadingEventFile(false)
  }

  // 이벤트를 드래그해서 다른 날짜로 이동
  const handleEventDrop = async (targetDate: string) => {
    if (!dragId) return
    const ev = events.find(e => e.id === dragId)
    setDragId(null)
    if (!ev || ev.date === targetDate) return
    const delta = differenceInCalendarDays(parseISO(targetDate), parseISO(ev.date))
    const newEnd = ev.end_date ? format(addDays(parseISO(ev.end_date), delta), 'yyyy-MM-dd') : null
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, date: targetDate, end_date: newEnd ?? undefined } : e))
    await supabase.from('events').update({ date: targetDate, end_date: newEnd }).eq('id', ev.id)
    await fetchAll()
  }

  const monthStart = startOfMonth(calDate)
  const leadPad = (getDay(monthStart) + 6) % 7
  const weeks = Math.ceil((leadPad + endOfMonth(calDate).getDate()) / 7)
  const gridStart = subDays(monthStart, leadPad)
  const gridDays = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))
  const cy = calDate.getFullYear()
  const holidays = holidaysForYears([cy - 1, cy, cy + 1])
  const dayEvents = (date: Date) => {
    const ds = format(date, 'yyyy-MM-dd')
    return sortEvents(events.filter(e => {
      if (e.date === ds) return true
      if (e.end_date && e.end_date >= ds && e.date <= ds) return true
      return false
    }))
  }
  const selectedEvents = selectedDate ? sortEvents(events.filter(e => {
    if (e.date === selectedDate) return true
    if (e.end_date && e.end_date >= selectedDate && e.date <= selectedDate) return true
    return false
  })) : []

  const renderCellEvent = (event: CalendarEvent, dateStr: string) => {
    const isBirthday = event.title.startsWith('🎂')
    const pc = isBirthday ? { bg: 'bg-red-100', text: 'text-red-600' } : PERSON_COLORS[event.person]
    const isStart = event.date === dateStr
    const isEnd = (event.end_date || event.date) === dateStr
    return (
      <div key={event.id}
        draggable={!isBirthday}
        onDragStart={e => { if (isBirthday) { e.preventDefault(); return } setDragId(event.id) }}
        onDragEnd={() => setDragId(null)}
        onClick={e => e.stopPropagation()}
        onDoubleClick={e => { e.stopPropagation(); if (!isBirthday) openEditEvent(event) }}
        className={`flex items-center text-[13px] px-0.5 py-0.5 ${pc.bg} ${pc.text} ${isStart ? 'rounded-l' : '-ml-1'} ${isEnd ? 'rounded-r' : '-mr-1'} ${!isBirthday ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        {isStart ? (
          <>
            <span className="truncate flex-1">{event.title}</span>
            {event.time && <span className="flex-shrink-0 ml-0.5 text-[10px] opacity-80">{formatKoreanTime(event.time)}</span>}
          </>
        ) : <span className="opacity-0 select-none">l</span>}
      </div>
    )
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
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-lg">📋 Todo</h3>
            <div className="flex items-center gap-2">
              <Link href="/todos" className="text-sm text-blue-500 hover:underline">전체보기</Link>
              <button onClick={openAddTodo}
                className="flex items-center gap-1 bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
                <Plus size={16} /> 추가
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {homeTodos.length === 0 && <p className="text-sm text-slate-400 text-center py-3">할 일이 없어요 🎉</p>}
            {homeTodos.map(todo => {
              const dl = todo.deadline ? daysLeft(todo.deadline) : null
              const badge = ownerBadge(todo.owner || viewer)
              return (
                <div key={todo.id} onDoubleClick={() => openEditTodo(todo)}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg group cursor-pointer">
                  <button onClick={() => handleTodoToggle(todo)} className="w-[30px] h-[30px] rounded-full border-2 border-slate-300 flex-shrink-0 hover:bg-slate-200 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-slate-800 truncate">{todo.title}</p>
                      {todo.visibility === 'both' && <span className={`text-xs px-1 rounded font-bold flex-shrink-0 ${badge.cls}`}>{badge.label}</span>}
                    </div>
                    {dl && <p className={`text-xs font-medium ${dl.color}`}>{dl.label}{todo.deadline && ` · ${format(parseISO(todo.deadline), 'M/d')}`}</p>}
                  </div>
                  <button onClick={() => handleTodoDelete(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={18} /></button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Project */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-lg">🗂️ Project</h3>
            <div className="flex items-center gap-2">
              <Link href="/projects" className="text-sm text-blue-500 hover:underline">전체보기</Link>
              <button onClick={openAddProject}
                className="flex items-center gap-1 bg-purple-500 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-purple-600 transition-colors">
                <Plus size={16} /> 추가
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {visibleProjects.length === 0 && <p className="text-sm text-slate-400 py-1">진행 중인 프로젝트가 없어요</p>}
            {visibleProjects.map(project => {
              const dl = project.deadline ? daysLeft(project.deadline) : null
              return (
                <div key={project.id} onDoubleClick={() => setSelectedProject(project)}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg group cursor-pointer">
                  <div className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{project.title}</p>
                    {dl && <p className={`text-xs ${dl.color}`}>{dl.label}</p>}
                  </div>
                  <button onClick={() => handleProjectComplete(project)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full hover:bg-green-200 transition-all flex-shrink-0">
                    <Check size={15} /> 완료
                  </button>
                  <button onClick={() => handleProjectDelete(project.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={18} /></button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button onClick={() => setCalDate(new Date())} className="text-sm font-medium text-blue-500 hover:bg-blue-50 rounded-lg px-2.5 py-1 transition-colors">오늘</button>
            <button onClick={() => setCalDate(subMonths(calDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} className="text-slate-600" /></button>
          </div>
          <h3 className="font-semibold text-slate-800 text-xl">{format(calDate, 'yyyy년 M월')}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => openAddEvent()} className="flex items-center gap-1 bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              <Plus size={16} /> 추가
            </button>
            <button onClick={() => setCalDate(addMonths(calDate, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} className="text-slate-600" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-2 ${i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {gridDays.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const inMonth = isSameMonth(day, calDate)
            const de = dayEvents(day)
            const isSelected = selectedDate === dateStr
            const todayMark = isToday(day)
            const dow = getDay(day)
            const isLastRow = i >= (weeks - 1) * 7
            const holiday = holidays[dateStr]
            return (
              <div key={dateStr} onClick={() => openAddEvent(dateStr)}
                onDragOver={e => { if (dragId) e.preventDefault() }}
                onDrop={() => handleEventDrop(dateStr)}
                className={`border-b border-r border-slate-50 min-h-[80px] p-1 cursor-pointer hover:bg-slate-50 transition-colors ${isLastRow ? 'border-b-0' : ''} ${dragId ? 'hover:bg-blue-100' : ''} ${!inMonth ? 'bg-slate-50/40' : ''}`}>
                <div className="flex items-center gap-1 mb-0.5">
                  <div className={`text-base font-medium w-8 h-8 flex items-center justify-center rounded-full ${todayMark ? 'bg-blue-500 text-white' : !inMonth ? (holiday ? 'text-red-300' : 'text-slate-300') : (holiday || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}`}>
                    {format(day, 'd')}
                  </div>
                  {holiday && inMonth && <span className="text-[10px] text-red-400 truncate">{holiday}</span>}
                </div>
                <div className="space-y-0.5">
                  {de.slice(0, 5).map(event => renderCellEvent(event, dateStr))}
                  {de.length > 5 && <div className="text-xs text-slate-400 px-0.5">+{de.length - 5}</div>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-4 px-6 py-3 border-t border-slate-50">
          {Object.entries(PERSON_COLORS).map(([key, pc]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: pc.dot }} />
              <span className="text-xs text-slate-400">{pc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Todo 모달 (추가 / 수정) */}
      {showTodoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setShowTodoModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editTodo ? 'Todo 수정' : 'Todo 추가'}</h3>
              <button onClick={() => setShowTodoModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="할 일 입력" value={todoForm.title}
                onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && todoForm.title.trim()) handleTodoSave() }} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">마감일</label>
                <DatePickerInput value={todoForm.deadline} onChange={v => setTodoForm(f => ({ ...f, deadline: v }))} className="w-full" />
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

      {/* Project 추가 모달 (프로젝트 페이지와 동일) */}
      {showProjectModal && (
        <ProjectAddModal viewer={viewer} defaultStatus="in_progress"
          onClose={() => setShowProjectModal(false)}
          onSaved={proj => { setShowProjectModal(false); fetchAll(); setSelectedProject(proj) }} />
      )}

      {/* Project 상세/수정 모달 (프로젝트 페이지와 동일) */}
      {selectedProject && (
        <ProjectDetailModal project={selectedProject} viewer={viewer}
          onClose={() => setSelectedProject(null)} onChanged={fetchAll} />
      )}

      {/* 일정 모달 (추가 / 수정) */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setShowEventModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editEvent ? '일정 수정' : '일정 추가'}</h3>
              <button onClick={() => setShowEventModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                placeholder="일정 제목" value={eventForm.title}
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && eventForm.title.trim()) handleEventSave() }} autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">시작일</label>
                  <DatePickerInput value={eventForm.date} onChange={v => setEventForm(f => ({ ...f, date: v }))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">종료일 (선택)</label>
                  <DatePickerInput value={eventForm.end_date} onChange={v => setEventForm(f => ({ ...f, end_date: v }))} className="w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시간 (선택)</label>
                <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                  value={eventForm.time} onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">누구의 일정?</label>
                <div className="flex gap-2">
                  {[{ v: 'eddy', label: 'Eddy', cls: 'bg-blue-50 border-blue-300 text-blue-600' },
                    { v: 'judy', label: 'Judy', cls: 'bg-yellow-50 border-yellow-300 text-yellow-600' },
                    { v: 'both', label: '함께', cls: 'bg-green-50 border-green-300 text-green-600' }].map(opt => (
                    <button key={opt.v} onClick={() => setEventForm(f => ({ ...f, person: opt.v as 'eddy' | 'judy' | 'both' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${eventForm.person === opt.v ? opt.cls : 'border-slate-200 text-slate-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모 / 기록</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400 resize-y"
                  rows={5} placeholder="자유롭게 기록하세요..."
                  value={eventForm.note} onChange={e => setEventForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              {/* 사진 첨부 (여러 장) */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">사진</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {eventForm.photos.map((url, i) => (
                    <div key={i} className="relative w-16 h-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" onClick={() => setLightbox(url)} className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80" />
                      <button onClick={() => setEventForm(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">×</button>
                    </div>
                  ))}
                  <label className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-slate-300 text-slate-400 text-xs">
                    {uploadingEventFile ? '...' : '+ 사진'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) handleEventPhotos(e.target.files) }} />
                  </label>
                </div>
              </div>
              {editEvent && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">첨부파일</label>
                  {editEvent.file_url && (
                    <a href={editEvent.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline block mb-1">📎 현재 첨부파일</a>
                  )}
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f && editEvent) handleEventFileUpload(f, editEvent.id) }} />
                    <span className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      {uploadingEventFile ? '업로드 중...' : '파일 첨부'}
                    </span>
                  </label>
                </div>
              )}
              {editEvent && (
                <button onClick={() => { handleEventDelete(editEvent.id); setShowEventModal(false) }}
                  className="w-full border border-red-200 text-red-400 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">
                  삭제
                </button>
              )}
              <button onClick={handleEventSave} disabled={!eventForm.title.trim()}
                className="w-full bg-slate-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 원본 보기 (라이트박스) */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <div className="flex justify-center gap-2 mt-3">
              <button onClick={() => downloadPhoto(lightbox)} className="flex items-center gap-1.5 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"><Download size={16} /> 다운로드</button>
              <button onClick={() => setLightbox(null)} className="bg-white/20 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/30 transition-colors">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
