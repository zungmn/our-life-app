'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Project, ProjectMemo, Todo } from '@/lib/supabase'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, X, Trash2, Check, ChevronDown, MessageSquare, ListTodo, Paperclip } from 'lucide-react'
import DatePickerInput from '@/components/DatePickerInput'

const STATUS_INFO = {
  planned: { label: '예정', color: 'bg-slate-100 text-slate-600', dot: '#94A3B8' },
  in_progress: { label: '진행중', color: 'bg-blue-100 text-blue-600', dot: '#3B82F6' },
  completed: { label: '완료', color: 'bg-green-100 text-green-600', dot: '#10B981' },
}

const VIS_OPTIONS = [
  { v: 'both', label: '🔓 함께' },
  { v: 'eddy', label: '🔵 Eddy만' },
  { v: 'judy', label: '🩷 Judy만' },
]

export default function ProjectsPage() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Project | null>(null)
  const [memos, setMemos] = useState<ProjectMemo[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [memoText, setMemoText] = useState('')
  const [todoText, setTodoText] = useState('')
  const [todoDeadline, setTodoDeadline] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '', deadline: '', status: 'planned' as Project['status'],
    shared: true, memo: ''
  })
  const [pendingTodos, setPendingTodos] = useState<{ text: string; deadline: string }[]>([])
  const [pendingTodoText, setPendingTodoText] = useState('')
  const [pendingTodoDeadline, setPendingTodoDeadline] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
  }, [])

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
    setProjects(data || [])
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const fetchDetail = useCallback(async (project: Project) => {
    const [memosRes, todosRes] = await Promise.all([
      supabase.from('project_memos').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
      supabase.from('todos').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
    ])
    setMemos(memosRes.data || [])
    setTodos(todosRes.data || [])
  }, [])

  const openDetail = (project: Project) => {
    setSelected(project)
    fetchDetail(project)
  }

  const isVisible = (visibility: string) => {
    if (viewer === 'eddy') return visibility === 'eddy' || visibility === 'both'
    return visibility === 'judy' || visibility === 'both'
  }

  const daysLeft = (deadline: string) => {
    const d = differenceInCalendarDays(parseISO(deadline), new Date())
    if (d < 0) return { label: `${Math.abs(d)}일 초과`, color: 'text-red-500' }
    if (d === 0) return { label: '오늘 마감', color: 'text-red-500' }
    return { label: `D-${d}`, color: d <= 7 ? 'text-orange-500' : 'text-slate-400' }
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    const visibility = form.shared ? 'both' : viewer
    const { data: proj, error } = await supabase.from('projects').insert({
      title: form.title, status: form.status, visibility, deadline: form.deadline || null,
    }).select().single()
    if (error) { alert('저장 실패: ' + error.message); return }
    if (form.memo.trim() && proj) {
      await supabase.from('project_memos').insert({ project_id: proj.id, content: form.memo, author: viewer })
    }
    for (const t of pendingTodos) {
      if (t.text.trim() && proj) {
        await supabase.from('todos').insert({ title: t.text, completed: false, visibility, owner: viewer, project_id: proj.id, deadline: t.deadline || null })
      }
    }
    setForm({ title: '', deadline: '', status: 'planned', shared: true, memo: '' })
    setPendingTodos([])
    setPendingTodoText('')
    setPendingTodoDeadline('')
    setShowModal(false)
    if (proj) { setSelected(proj); fetchDetail(proj) }
    fetchProjects()
  }

  const handleStatusChange = async (project: Project, status: Project['status']) => {
    await supabase.from('projects').update({ status }).eq('id', project.id)
    setSelected(p => p ? { ...p, status } : p)
    fetchProjects()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id)
    setSelected(null)
    fetchProjects()
  }

  const handleAddMemo = async () => {
    if (!memoText.trim() || !selected) return
    await supabase.from('project_memos').insert({
      project_id: selected.id,
      content: memoText,
      author: viewer,
    })
    setMemoText('')
    fetchDetail(selected)
  }

  const handleFileUpload = async (file: File, projectId: string) => {
    setUploadingFile(true)
    const ext = file.name.split('.').pop()
    const path = `projects/${projectId}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('archive').upload(path, file, { upsert: true })
    if (error) { alert('파일 업로드 실패: ' + error.message); setUploadingFile(false); return }
    const { data } = supabase.storage.from('archive').getPublicUrl(path)
    await supabase.from('projects').update({ file_url: data.publicUrl }).eq('id', projectId)
    setSelected(s => s ? { ...s, file_url: data.publicUrl } : s)
    await fetchProjects()
    setUploadingFile(false)
  }

  const handleAddTodo = async () => {
    if (!todoText.trim() || !selected) return
    await supabase.from('todos').insert({
      title: todoText, completed: false, visibility: selected.visibility,
      owner: viewer, project_id: selected.id, deadline: todoDeadline || null,
    })
    setTodoText('')
    setTodoDeadline('')
    fetchDetail(selected)
  }

  const handleTodoToggle = async (todo: Todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    if (selected) fetchDetail(selected)
  }

  const grouped = {
    planned: projects.filter(p => isVisible(p.visibility) && p.status === 'planned'),
    in_progress: projects.filter(p => isVisible(p.visibility) && p.status === 'in_progress'),
    completed: projects.filter(p => isVisible(p.visibility) && p.status === 'completed'),
  }

  return (
    <div className="p-6 md:p-10 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">🗂️ Project</h2>
          <p className="text-base text-slate-400 mt-0.5">{viewer === 'eddy' ? 'Eddy' : 'Judy'} 화면</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-purple-500 text-white px-5 py-2.5 rounded-lg text-lg hover:bg-purple-600 transition-colors">
          <Plus size={22} /> 추가
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {(['planned', 'in_progress', 'completed'] as const).map(status => {
          const items = grouped[status]
          const info = STATUS_INFO[status]
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: info.dot }} />
                <h3 className="text-lg font-semibold text-slate-600">{info.label}</h3>
                <span className="text-base text-slate-400">({items.length})</span>
              </div>
              {items.length === 0 ? (
                <p className="text-base text-slate-300 pl-4">없음</p>
              ) : (
                <div className="space-y-2">
                  {items.map(project => {
                    const dl = project.deadline ? daysLeft(project.deadline) : null
                    return (
                      <button key={project.id} onClick={() => openDetail(project)}
                        className="card p-4 w-full text-left hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 text-xl">{project.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {dl && <p className={`text-base ${dl.color}`}>{dl.label}</p>}
                              <span className="text-base text-slate-400">
                                {project.visibility === 'both' ? '함께' : project.visibility === 'eddy' ? 'Eddy' : 'Judy'}
                              </span>
                            </div>
                          </div>
                          <ChevronDown size={20} className="text-slate-300 flex-shrink-0 -rotate-90" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{selected.title}</h3>
                  {selected.deadline && (
                    <p className={`text-xs mt-0.5 ${daysLeft(selected.deadline).color}`}>
                      마감: {format(parseISO(selected.deadline), 'yyyy.M.d (EEEE)', { locale: ko })} · {daysLeft(selected.deadline).label}
                    </p>
                  )}
                </div>
                <button onClick={() => setSelected(null)}><X size={20} className="text-slate-400" /></button>
              </div>

              {/* Status buttons */}
              <div className="flex gap-2 mt-3">
                {(Object.entries(STATUS_INFO) as [Project['status'], typeof STATUS_INFO['planned']][]).map(([s, info]) => (
                  <button key={s} onClick={() => handleStatusChange(selected, s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selected.status === s ? info.color : 'bg-slate-50 text-slate-400'
                    }`}>
                    {info.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Memos */}
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={14} className="text-slate-500" />
                <h4 className="text-sm font-semibold text-slate-700">진행 메모</h4>
              </div>
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {memos.length === 0 && <p className="text-xs text-slate-400">메모가 없어요</p>}
                {memos.map(memo => (
                  <div key={memo.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        memo.author === 'eddy' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                      }`}>{memo.author === 'eddy' ? 'Eddy' : 'Judy'}</span>
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(memo.created_at), 'M.d HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{memo.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                  placeholder="메모 추가..." value={memoText}
                  onChange={e => setMemoText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddMemo()} />
                <button onClick={handleAddMemo}
                  className="bg-purple-500 text-white px-3 rounded-lg text-sm hover:bg-purple-600 transition-colors">
                  추가
                </button>
              </div>
            </div>

            {/* Project Todos */}
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <ListTodo size={14} className="text-slate-500" />
                <h4 className="text-sm font-semibold text-slate-700">관련 Todo</h4>
              </div>
              <div className="space-y-1.5 mb-3">
                {todos.length === 0 && <p className="text-xs text-slate-400">관련 Todo가 없어요</p>}
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-center gap-2">
                    <button onClick={() => handleTodoToggle(todo)}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        todo.completed ? 'bg-slate-300 border-slate-300' : 'border-slate-300 hover:bg-slate-100'
                      }`}>
                      {todo.completed && <Check size={10} className="text-white" />}
                    </button>
                    <p className={`text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {todo.title}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="Todo 추가..." value={todoText}
                  onChange={e => setTodoText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTodo()} />
                <div className="flex gap-2">
                  <DatePickerInput value={todoDeadline} onChange={setTodoDeadline} className="flex-1" />
                  <button onClick={handleAddTodo}
                    className="bg-blue-500 text-white px-4 rounded-lg text-sm hover:bg-blue-600 transition-colors flex-shrink-0">
                    추가
                  </button>
                </div>
              </div>
            </div>

            {/* File attachment */}
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip size={14} className="text-slate-500" />
                <h4 className="text-sm font-semibold text-slate-700">첨부파일</h4>
              </div>
              {selected.file_url && (
                <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline block mb-2 truncate">
                  📎 첨부파일 보기
                </a>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer hover:text-slate-700 transition-colors">
                <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, selected.id) }} />
                <span className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  {uploadingFile ? '업로드 중...' : selected.file_url ? '파일 교체' : '파일 첨부'}
                </span>
              </label>
            </div>

            <div className="p-5">
              <button onClick={() => handleDelete(selected.id)}
                className="flex items-center gap-2 text-red-400 text-sm hover:text-red-600 transition-colors">
                <Trash2 size={14} /> 프로젝트 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Project 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                placeholder="프로젝트명" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">마감일 (선택)</label>
                <DatePickerInput value={form.deadline} onChange={v => setForm(f => ({ ...f, deadline: v }))} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">상태</label>
                <div className="flex gap-2">
                  {(Object.entries(STATUS_INFO) as [Project['status'], typeof STATUS_INFO['planned']][]).map(([s, info]) => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.status === s ? info.color + ' border-transparent' : 'border-slate-200 text-slate-500'
                      }`}>
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.shared ? 'bg-purple-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.shared ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">함께 보기</p>
                  <p className="text-xs text-slate-400">{form.shared ? 'Eddy & Judy 모두 볼 수 있음' : `${viewer === 'eddy' ? 'Eddy' : 'Judy'}만 볼 수 있음`}</p>
                </div>
                <input type="checkbox" className="hidden" checked={form.shared} onChange={e => setForm(f => ({ ...f, shared: e.target.checked }))} />
              </label>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">첫 번째 메모 (선택)</label>
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 resize-none"
                  rows={3} placeholder="진행 상황, 메모..."
                  value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
              {/* Pending todos */}
              <div className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ListTodo size={13} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600">관련 Todo</span>
                </div>
                {pendingTodos.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {pendingTodos.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0" />
                        <span className="flex-1 text-slate-700">{t.text}</span>
                        {t.deadline && <span className="text-slate-400">{t.deadline}</span>}
                        <button onClick={() => setPendingTodos(p => p.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-1"
                  placeholder="Todo 추가..." value={pendingTodoText}
                  onChange={e => setPendingTodoText(e.target.value)} />
                <div className="flex gap-2">
                  <DatePickerInput value={pendingTodoDeadline} onChange={setPendingTodoDeadline} className="flex-1" />
                  <button onClick={() => { if (pendingTodoText.trim()) { setPendingTodos(p => [...p, { text: pendingTodoText, deadline: pendingTodoDeadline }]); setPendingTodoText(''); setPendingTodoDeadline('') } }}
                    className="bg-blue-500 text-white px-3 rounded-lg text-xs hover:bg-blue-600 transition-colors flex-shrink-0">추가</button>
                </div>
              </div>

              <button onClick={handleSave} disabled={!form.title.trim()}
                className="w-full bg-purple-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors">
                저장 후 상세 열기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
