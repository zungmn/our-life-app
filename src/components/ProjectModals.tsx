'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Project, ProjectMemo, Todo } from '@/lib/supabase'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, Trash2, Check, MessageSquare, ListTodo, Paperclip } from 'lucide-react'
import DatePickerInput from '@/components/DatePickerInput'

const STATUS_INFO = {
  planned: { label: '예정', color: 'bg-slate-100 text-slate-600', dot: '#94A3B8' },
  in_progress: { label: '진행중', color: 'bg-blue-100 text-blue-600', dot: '#3B82F6' },
  completed: { label: '완료', color: 'bg-green-100 text-green-600', dot: '#10B981' },
}

function daysLeft(deadline: string) {
  const d = differenceInCalendarDays(parseISO(deadline), new Date())
  if (d < 0) return { label: `${Math.abs(d)}일 초과`, color: 'text-red-500' }
  if (d === 0) return { label: '오늘 마감', color: 'text-red-500' }
  return { label: `D-${d}`, color: d <= 7 ? 'text-orange-500' : 'text-slate-400' }
}

/* ─────────────── 상세 / 수정 모달 ─────────────── */
export function ProjectDetailModal({
  project, viewer, onClose, onChanged,
}: {
  project: Project
  viewer: 'eddy' | 'judy'
  onClose: () => void
  onChanged: () => void
}) {
  const [current, setCurrent] = useState<Project>(project)
  const [memos, setMemos] = useState<ProjectMemo[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [memoText, setMemoText] = useState('')
  const [editMemoId, setEditMemoId] = useState<string | null>(null)
  const [editMemoText, setEditMemoText] = useState('')
  const [openMemos, setOpenMemos] = useState<Record<string, boolean>>({})
  const [todoText, setTodoText] = useState('')
  const [todoDeadline, setTodoDeadline] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => { setCurrent(project) }, [project])

  const fetchDetail = useCallback(async () => {
    const [memosRes, todosRes] = await Promise.all([
      supabase.from('project_memos').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
      supabase.from('todos').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
    ])
    setMemos(memosRes.data || [])
    setTodos(todosRes.data || [])
  }, [project.id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const handleStatusChange = async (status: Project['status']) => {
    await supabase.from('projects').update({ status }).eq('id', current.id)
    setCurrent(p => ({ ...p, status }))
    onChanged()
  }

  const handleDelete = async () => {
    await supabase.from('projects').delete().eq('id', current.id)
    onChanged()
    onClose()
  }

  const handleAddMemo = async () => {
    if (!memoText.trim()) return
    await supabase.from('project_memos').insert({ project_id: current.id, content: memoText, author: viewer })
    setMemoText('')
    fetchDetail()
  }
  const handleUpdateMemo = async () => {
    if (!editMemoId || !editMemoText.trim()) return
    await supabase.from('project_memos').update({ content: editMemoText }).eq('id', editMemoId)
    setEditMemoId(null); setEditMemoText('')
    fetchDetail()
  }
  const handleDeleteMemo = async (id: string) => {
    await supabase.from('project_memos').delete().eq('id', id)
    fetchDetail()
  }
  // 체크리스트 한 줄 토글 → 메모 내용 갱신
  const toggleChecklistItem = async (memo: ProjectMemo, lineIdx: number) => {
    const lines = memo.content.split('\n')
    const line = lines[lineIdx]
    if (/^\s*-\s*\[ \]/.test(line)) lines[lineIdx] = line.replace('[ ]', '[x]')
    else if (/^\s*-\s*\[[xX]\]/.test(line)) lines[lineIdx] = line.replace(/\[[xX]\]/, '[ ]')
    else return
    const content = lines.join('\n')
    await supabase.from('project_memos').update({ content }).eq('id', memo.id)
    setMemos(ms => ms.map(m => m.id === memo.id ? { ...m, content } : m))
  }

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true)
    const ext = file.name.split('.').pop()
    const path = `projects/${current.id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('archive').upload(path, file, { upsert: true })
    if (error) { alert('파일 업로드 실패: ' + error.message); setUploadingFile(false); return }
    const { data } = supabase.storage.from('archive').getPublicUrl(path)
    await supabase.from('projects').update({ file_url: data.publicUrl }).eq('id', current.id)
    setCurrent(s => ({ ...s, file_url: data.publicUrl }))
    onChanged()
    setUploadingFile(false)
  }

  const handleAddTodo = async () => {
    if (!todoText.trim()) return
    await supabase.from('todos').insert({
      title: todoText, completed: false, visibility: current.visibility,
      owner: viewer, project_id: current.id, deadline: todoDeadline || null,
    })
    setTodoText(''); setTodoDeadline('')
    fetchDetail()
  }
  const handleTodoToggle = async (todo: Todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    fetchDetail()
  }

  // 메모 렌더: 한 줄 = 체크리스트면 체크박스, 아니면 텍스트
  const renderLine = (memo: ProjectMemo, line: string, idx: number) => {
    const m = line.match(/^(\s*)-\s*\[( |x|X)\]\s?(.*)$/)
    if (m) {
      const checked = m[2].toLowerCase() === 'x'
      return (
        <div key={idx} className="flex items-start gap-1.5">
          <button onClick={() => toggleChecklistItem(memo, idx)}
            className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-purple-500 border-purple-500' : 'border-slate-300 hover:bg-slate-100'}`}>
            {checked && <Check size={10} className="text-white" />}
          </button>
          <span className={`text-sm ${checked ? 'line-through text-slate-400' : 'text-slate-600'}`}>{m[3]}</span>
        </div>
      )
    }
    return <p key={idx} className="text-sm text-slate-600 whitespace-pre-wrap">{line}</p>
  }

  const renderMemoBody = (memo: ProjectMemo) => {
    const lines = memo.content.split('\n')
    const bodyLines = lines.slice(1)
    const hasBody = bodyLines.join('\n').trim().length > 0
    if (!hasBody) return renderLine(memo, lines[0], 0)
    const open = !!openMemos[memo.id]
    const title = lines[0]
    return (
      <div>
        <button onClick={() => setOpenMemos(m => ({ ...m, [memo.id]: !open }))}
          className="flex items-start gap-1.5 text-left w-full">
          <span className={`text-slate-400 mt-0.5 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-sm font-medium text-slate-700 flex-1">{title || '(제목 없음)'}</span>
        </button>
        {open && (
          <div className="mt-1 ml-5 pl-2 border-l-2 border-slate-200 space-y-0.5">
            {bodyLines.map((l, i) => renderLine(memo, l, i + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-800">{current.title}</h3>
              {current.deadline && (
                <p className={`text-xs mt-0.5 ${daysLeft(current.deadline).color}`}>
                  마감: {format(parseISO(current.deadline), 'yyyy.M.d (EEEE)', { locale: ko })} · {daysLeft(current.deadline).label}
                </p>
              )}
            </div>
            <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
          </div>
          <div className="flex gap-2 mt-3">
            {(Object.entries(STATUS_INFO) as [Project['status'], typeof STATUS_INFO['planned']][]).map(([s, info]) => (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${current.status === s ? info.color : 'bg-slate-50 text-slate-400'}`}>
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
          <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
            {memos.length === 0 && <p className="text-xs text-slate-400">메모가 없어요</p>}
            {memos.map(memo => (
              <div key={memo.id} onDoubleClick={() => { setEditMemoId(memo.id); setEditMemoText(memo.content) }}
                className="bg-slate-50 rounded-lg p-3 group">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${memo.author === 'eddy' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>{memo.author === 'eddy' ? 'Eddy' : 'Judy'}</span>
                  <span className="text-[10px] text-slate-400">{format(new Date(memo.created_at), 'M.d HH:mm')}</span>
                  {editMemoId !== memo.id && (
                    <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditMemoId(memo.id); setEditMemoText(memo.content) }} className="text-slate-300 hover:text-blue-400">✏️</button>
                      <button onClick={() => handleDeleteMemo(memo.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                {editMemoId === memo.id ? (
                  <div className="space-y-2">
                    <textarea className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 resize-none"
                      rows={4} value={editMemoText} onChange={e => setEditMemoText(e.target.value)} autoFocus />
                    <div className="flex gap-2">
                      <button onClick={handleUpdateMemo} className="bg-purple-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-purple-600 transition-colors">저장</button>
                      <button onClick={() => { setEditMemoId(null); setEditMemoText('') }} className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-xs hover:bg-slate-200 transition-colors">취소</button>
                    </div>
                  </div>
                ) : renderMemoBody(memo)}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 resize-y"
              rows={3} placeholder="메모 추가… (첫 줄=제목, Shift+Enter 줄바꿈 · '- [ ] 할일'로 체크리스트)" value={memoText}
              onChange={e => setMemoText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddMemo() } }} />
            <button onClick={handleAddMemo} className="bg-purple-500 text-white px-3 rounded-lg text-sm hover:bg-purple-600 transition-colors flex-shrink-0">추가</button>
          </div>
        </div>

        {/* Todos */}
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
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${todo.completed ? 'bg-slate-300 border-slate-300' : 'border-slate-300 hover:bg-slate-100'}`}>
                  {todo.completed && <Check size={10} className="text-white" />}
                </button>
                <p className={`text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{todo.title}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Todo 추가..." value={todoText}
              onChange={e => setTodoText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTodo()} />
            <DatePickerInput value={todoDeadline} onChange={setTodoDeadline} className="w-32" />
            <button onClick={handleAddTodo} className="bg-blue-500 text-white px-3 rounded-lg text-sm hover:bg-blue-600 transition-colors flex-shrink-0">추가</button>
          </div>
        </div>

        {/* File */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip size={14} className="text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-700">첨부파일</h4>
          </div>
          {current.file_url && (
            <a href={current.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline block mb-2 truncate">📎 첨부파일 보기</a>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer hover:text-slate-700 transition-colors">
            <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
            <span className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{uploadingFile ? '업로드 중...' : current.file_url ? '파일 교체' : '파일 첨부'}</span>
          </label>
        </div>

        <div className="p-5">
          <button onClick={handleDelete} className="flex items-center gap-2 text-red-400 text-sm hover:text-red-600 transition-colors">
            <Trash2 size={14} /> 프로젝트 삭제
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── 추가 모달 ─────────────── */
export function ProjectAddModal({
  viewer, defaultStatus = 'planned', onClose, onSaved,
}: {
  viewer: 'eddy' | 'judy'
  defaultStatus?: Project['status']
  onClose: () => void
  onSaved: (project: Project) => void
}) {
  const [form, setForm] = useState({ title: '', deadline: '', status: defaultStatus, shared: true, memo: '' })
  const [pendingTodos, setPendingTodos] = useState<{ text: string; deadline: string }[]>([])
  const [pendingTodoText, setPendingTodoText] = useState('')
  const [pendingTodoDeadline, setPendingTodoDeadline] = useState('')

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
    if (proj) onSaved(proj)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Project 추가</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
            placeholder="프로젝트명" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          <div>
            <label className="text-xs text-slate-500 mb-1 block">마감일 (선택)</label>
            <DatePickerInput value={form.deadline} onChange={v => setForm(f => ({ ...f, deadline: v }))} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">상태</label>
            <div className="flex gap-2">
              {(Object.entries(STATUS_INFO) as [Project['status'], typeof STATUS_INFO['planned']][]).map(([s, info]) => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${form.status === s ? info.color + ' border-transparent' : 'border-slate-200 text-slate-500'}`}>
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
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 resize-y"
              rows={3} placeholder="첫 줄=제목, 줄바꿈으로 본문 · '- [ ] 할일'로 체크리스트"
              value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
          </div>
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
              placeholder="Todo 추가..." value={pendingTodoText} onChange={e => setPendingTodoText(e.target.value)} />
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
  )
}
