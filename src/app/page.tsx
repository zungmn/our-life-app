'use client'

import { useEffect, useState } from 'react'
import { supabase, Event, Transaction } from '@/lib/supabase'
import { PERSON_COLORS } from '@/lib/constants'
import { CalendarDays, PiggyBank, BookOpen, NotebookPen, Star, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function Home() {
  const [todayEvents, setTodayEvents] = useState<Event[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [monthExpense, setMonthExpense] = useState(0)
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'M월 d일 (EEEE)', { locale: ko })

  useEffect(() => {
    async function load() {
      const startOfMonth = format(new Date(), 'yyyy-MM-01')
      const [eventsRes, expensesRes] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(10),
        supabase
          .from('transactions')
          .select('amount')
          .eq('type', 'expense')
          .gte('date', startOfMonth),
      ])

      const events: Event[] = eventsRes.data || []
      setTodayEvents(events.filter(e => e.date === today))
      setUpcomingEvents(events.filter(e => e.date > today).slice(0, 5))
      const total = (expensesRes.data || []).reduce((sum: number, t: {amount: number}) => sum + t.amount, 0)
      setMonthExpense(total)
      setLoading(false)
    }
    load()
  }, [today])

  const quickCards = [
    { href: '/calendar', icon: CalendarDays, label: '캘린더', color: 'bg-blue-50 text-blue-600' },
    { href: '/expenses', icon: PiggyBank, label: '가계부', color: 'bg-green-50 text-green-600' },
    { href: '/books', icon: BookOpen, label: '독서', color: 'bg-amber-50 text-amber-600' },
    { href: '/journal', icon: NotebookPen, label: '일기', color: 'bg-purple-50 text-purple-600' },
    { href: '/life-notes', icon: Star, label: '인생기록', color: 'bg-pink-50 text-pink-600' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-slate-400">{todayLabel}</p>
        <h2 className="text-2xl font-bold text-slate-800 mt-0.5">잘했어, 잘하고 있어 ✨</h2>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {quickCards.map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href} className="card p-3 flex flex-col items-center gap-1.5 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={18} />
            </div>
            <span className="text-[11px] font-medium text-slate-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* Today schedule */}
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">오늘 일정</h3>
          <Link href="/calendar" className="text-xs text-blue-500 flex items-center gap-1">
            전체 <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        ) : todayEvents.length === 0 ? (
          <p className="text-sm text-slate-400 py-1">오늘 일정이 없어요 😊</p>
        ) : (
          <div className="space-y-2">
            {todayEvents.map(event => {
              const pc = PERSON_COLORS[event.person]
              return (
                <div key={event.id} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pc.dot }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{event.title}</p>
                    {event.time && <p className="text-xs text-slate-400">{event.time}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>{pc.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcomingEvents.length > 0 && (
        <div className="card p-4 mb-3">
          <h3 className="font-semibold text-slate-800 mb-3">다가오는 일정</h3>
          <div className="space-y-2">
            {upcomingEvents.map(event => {
              const pc = PERSON_COLORS[event.person]
              return (
                <div key={event.id} className="flex items-center gap-3">
                  <div className="text-xs text-slate-400 w-14 flex-shrink-0">
                    {format(new Date(event.date), 'M/d(E)', { locale: ko })}
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pc.dot }} />
                  <p className="text-sm text-slate-700 flex-1">{event.title}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Month expense */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-800">이번 달 지출</h3>
          <Link href="/expenses" className="text-xs text-blue-500 flex items-center gap-1">
            가계부 <ArrowRight size={12} />
          </Link>
        </div>
        <p className="text-2xl font-bold text-red-500">
          {loading ? '-' : `${monthExpense.toLocaleString()}원`}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{format(new Date(), 'yyyy년 M월')}</p>
      </div>
    </div>
  )
}
