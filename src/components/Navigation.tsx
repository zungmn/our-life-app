'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, BookOpen, PiggyBank, NotebookPen, Star, Home } from 'lucide-react'

const navItems = [
  { href: '/', icon: Home, label: '홈' },
  { href: '/calendar', icon: CalendarDays, label: '캘린더' },
  { href: '/expenses', icon: PiggyBank, label: '가계부' },
  { href: '/books', icon: BookOpen, label: '독서' },
  { href: '/journal', icon: NotebookPen, label: '일기' },
  { href: '/life-notes', icon: Star, label: '인생기록' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-slate-200 fixed left-0 top-0 z-40">
        <div className="p-5 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800">🏠 우리 집</h1>
          <p className="text-xs text-slate-400 mt-0.5">Eddy & Judy</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
          잘했어, 잘하고 있어 ✨
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 flex">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
