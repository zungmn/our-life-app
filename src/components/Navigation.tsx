'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, BookOpen, PiggyBank, NotebookPen, Star, Home, CheckSquare, FolderKanban, Archive } from 'lucide-react'
import { useEffect, useState } from 'react'

const sharedItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/todos', icon: CheckSquare, label: 'Todo' },
  { href: '/projects', icon: FolderKanban, label: 'Project' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/expenses', icon: PiggyBank, label: 'Budget' },
]

const eddyOnlyItems = [
  { href: '/books', icon: BookOpen, label: '독서' },
  { href: '/journal', icon: NotebookPen, label: '일기' },
  { href: '/life-notes', icon: Star, label: '기록' },
  { href: '/archive', icon: Archive, label: '자료실' },
]

export default function Navigation() {
  const pathname = usePathname()
  const [viewer, setViewer] = useState<'eddy' | 'judy'>('eddy')

  useEffect(() => {
    const update = () => {
      setViewer((localStorage.getItem('viewer') as 'eddy' | 'judy') || 'eddy')
    }
    update()
    window.addEventListener('storage', update)
    window.addEventListener('viewer-change', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('viewer-change', update)
    }
  }, [])

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => {
    const active = pathname === href
    return (
      <Link href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
        }`}>
        <Icon size={18} />
        {label}
      </Link>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-slate-200 fixed left-0 top-0 z-40">
        <div className="p-5 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800">🏠 우리 집</h1>
          <p className="text-xs text-slate-400 mt-0.5">Eddy & Judy</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sharedItems.map(item => <NavLink key={item.href} {...item} />)}
          {viewer === 'eddy' && (
            <>
              <div className="my-2 border-t border-slate-100" />
              {eddyOnlyItems.map(item => <NavLink key={item.href} {...item} />)}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button onClick={async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login' }}
            className="w-full text-xs text-slate-400 hover:text-slate-600 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
            로그아웃
          </button>
          <p className="text-[10px] text-slate-300 text-center mt-1">Eddy &amp; Judy house 🏠</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 flex">
        {sharedItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-blue-600' : 'text-slate-400'
              }`}>
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
