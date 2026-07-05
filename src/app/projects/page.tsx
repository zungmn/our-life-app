'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Project } from '@/lib/supabase'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { Plus, ChevronDown } from 'lucide-react'
import { ProjectDetailModal, ProjectAddModal } from '@/components/ProjectModals'

const STATUS_INFO = {
  planned: { label: '예정', color: 'bg-slate-100 text-slate-600', dot: '#94A3B8' },
  in_progress: { label: '진행중', color: 'bg-blue-100 text-blue-600', dot: '#3B82F6' },
  completed: { label: '완료', color: 'bg-green-100 text-green-600', dot: '#10B981' },
}

export default function ProjectsPage() {
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Project | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
  }, [])

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
    setProjects(data || [])
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

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

  const grouped = {
    planned: projects.filter(p => isVisible(p.visibility) && p.status === 'planned'),
    in_progress: projects.filter(p => isVisible(p.visibility) && p.status === 'in_progress'),
    completed: projects.filter(p => isVisible(p.visibility) && p.status === 'completed'),
  }

  return (
    <div className="p-6 md:p-10 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🗂️ Project</h2>
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
                      <button key={project.id} onClick={() => setSelected(project)}
                        className="card p-4 w-full text-left hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 text-base">{project.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {dl && <p className={`text-xs ${dl.color}`}>{dl.label}</p>}
                              <span className="text-xs text-slate-400">
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

      {selected && (
        <ProjectDetailModal project={selected} viewer={viewer}
          onClose={() => setSelected(null)} onChanged={fetchProjects} />
      )}

      {showModal && (
        <ProjectAddModal viewer={viewer}
          onClose={() => setShowModal(false)}
          onSaved={proj => { setShowModal(false); fetchProjects(); setSelected(proj) }} />
      )}
    </div>
  )
}
