'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Event } from '@/lib/supabase'
import { PERSON_COLORS } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', time: '', person: 'eddy' as 'eddy' | 'judy' | 'both', note: '' })
  const [loading, setLoading] = useState(false)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .gte('date', format(monthStart, 'yyyy-MM-dd'))
      .lte('date', format(monthEnd, 'yyyy-MM-dd'))
      .order('date', { ascending: true })
    setEvents(data || [])
  }, [currentDate])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const dayEvents = (date: Date) =>
    events.filter(e => e.date === format(date, 'yyyy-MM-dd'))

  const handleDayClick = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'))
    setForm({ title: '', time: '', person: 'eddy', note: '' })
  }

  const handleSave = async () => {
    if (!form.title.trim() || !selectedDate) return
    setLoading(true)
    await supabase.from('events').insert({
      title: form.title,
      date: selectedDate,
      time: form.time || null,
      person: form.person,
      note: form.note || null,
    })
    await fetchEvents()
    setShowModal(false)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('events').delete().eq('id', id)
    await fetchEvents()
  }

  const selectedEvents = selectedDate
    ? events.filter(e => e.date === selectedDate)
    : []

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Month header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <h2 className="text-xl font-bold text-slate-800">
          {format(currentDate, 'yyyy년 M월')}
        </h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="card overflow-hidden mb-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-2.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {Array(startPad).fill(null).map((_, i) => (
            <div key={`pad-${i}`} className="border-b border-r border-slate-50 min-h-[70px]" />
          ))}
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const de = dayEvents(day)
            const isSelected = selectedDate === dateStr
            const today = isToday(day)
            const dayOfWeek = getDay(day)
            const isLastRow = i >= days.length - 7

            return (
              <div
                key={dateStr}
                onClick={() => handleDayClick(day)}
                className={`border-b border-r border-slate-50 min-h-[70px] p-1 cursor-pointer hover:bg-slate-50 transition-colors ${
                  isSelected ? 'bg-blue-50' : ''
                } ${isLastRow ? 'border-b-0' : ''}`}
              >
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  today ? 'bg-blue-500 text-white' :
                  dayOfWeek === 0 ? 'text-red-400' :
                  dayOfWeek === 6 ? 'text-blue-400' :
                  'text-slate-700'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {de.slice(0, 2).map(event => {
                    const pc = PERSON_COLORS[event.person]
                    return (
                      <div key={event.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${pc.bg} ${pc.text}`}>
                        {event.title}
                      </div>
                    )
                  })}
                  {de.length > 2 && (
                    <div className="text-[10px] text-slate-400 px-1">+{de.length - 2}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-4">
        {Object.entries(PERSON_COLORS).map(([key, pc]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: pc.dot }} />
            <span className="text-xs text-slate-500">{pc.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day panel */}
      {selectedDate && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">
              {format(new Date(selectedDate), 'M월 d일 (EEEE)', { locale: ko })}
            </h3>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={14} /> 일정 추가
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">일정이 없어요. 추가해보세요!</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(event => {
                const pc = PERSON_COLORS[event.person]
                return (
                  <div key={event.id} className={`flex items-start gap-3 p-3 rounded-lg ${pc.bg}`}>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${pc.text}`}>{event.title}</p>
                      {event.time && <p className="text-xs text-slate-500 mt-0.5">{event.time}</p>}
                      {event.note && <p className="text-xs text-slate-500 mt-0.5">{event.note}</p>}
                      <span className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded-full ${pc.text} bg-white/60`}>{pc.label}</span>
                    </div>
                    <button onClick={() => handleDelete(event.id)} className="text-slate-400 hover:text-red-400 transition-colors mt-0.5">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add event modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">일정 추가</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">일정 이름 *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="일정 이름을 입력하세요"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시간 (선택)</label>
                <input
                  type="time"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">누구</label>
                <div className="flex gap-2">
                  {Object.entries(PERSON_COLORS).map(([key, pc]) => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, person: key as 'eddy' | 'judy' | 'both' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.person === key
                          ? `${pc.bg} ${pc.text} ${pc.border} border`
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      {pc.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                  rows={2}
                  placeholder="메모..."
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={loading || !form.title.trim()}
                className="w-full bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
