'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Event } from '@/lib/supabase'
import { PERSON_COLORS } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Paperclip } from 'lucide-react'
import DatePickerInput from '@/components/DatePickerInput'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const PERSON_ORDER: Record<string, number> = { both: 0, eddy: 1, judy: 2 }

function sortEvents(evs: Event[]) {
  return [...evs].sort((a, b) => {
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
  return `${period} ${hourDisplay}시 ${m}분`
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Event | null>(null)
  const [form, setForm] = useState({ title: '', end_date: '', time: '', person: 'eddy' as 'eddy' | 'judy' | 'both', note: '' })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

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

  const dayEvents = (date: Date) => {
    const ds = format(date, 'yyyy-MM-dd')
    return sortEvents(events.filter(e => {
      if (e.date === ds) return true
      if (e.end_date && e.end_date >= ds && e.date <= ds) return true
      return false
    }))
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ title: '', end_date: '', time: '', person: 'eddy', note: '' })
    setShowModal(true)
  }

  const openEdit = (event: Event) => {
    setEditItem(event)
    setForm({ title: event.title, end_date: event.end_date || '', time: event.time || '', person: event.person, note: event.note || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !selectedDate) return
    setLoading(true)
    const payload = {
      title: form.title,
      time: form.time || null,
      person: form.person,
      note: form.note || null,
      end_date: form.end_date || null,
    }
    if (editItem) {
      await supabase.from('events').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('events').insert({ ...payload, date: selectedDate })
    }
    await fetchEvents()
    setShowModal(false)
    setEditItem(null)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('events').delete().eq('id', id)
    await fetchEvents()
    setShowModal(false)
    setEditItem(null)
  }

  const handleFileUpload = async (file: File, eventId: string) => {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `events/${eventId}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('archive').upload(path, file, { upsert: true })
    if (error) { alert('업로드 실패: ' + error.message); setUploading(false); return }
    const { data } = supabase.storage.from('archive').getPublicUrl(path)
    await supabase.from('events').update({ file_url: data.publicUrl }).eq('id', eventId)
    await fetchEvents()
    setUploading(false)
  }

  const selectedEvents = selectedDate
    ? sortEvents(events.filter(e => {
        if (e.date === selectedDate) return true
        if (e.end_date && e.end_date >= selectedDate && e.date <= selectedDate) return true
        return false
      }))
    : []

  return (
    <div className="p-6 md:p-10 max-w-full">
      {/* Month header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft size={36} className="text-slate-600" />
        </button>
        <h2 className="text-[32px] font-bold text-slate-800">
          {format(currentDate, 'yyyy년 M월')}
        </h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight size={36} className="text-slate-600" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="card overflow-hidden mb-4">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-[24px] font-medium py-2.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array(startPad).fill(null).map((_, i) => (
            <div key={`pad-${i}`} className="border-b border-r border-slate-50 min-h-[220px]" />
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
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`border-b border-r border-slate-50 min-h-[220px] p-1 cursor-pointer hover:bg-slate-50 transition-colors ${
                  isSelected ? 'bg-blue-50' : ''
                } ${isLastRow ? 'border-b-0' : ''}`}
              >
                <div className={`text-[24px] font-medium w-12 h-12 flex items-center justify-center rounded-full mb-1 ${
                  today ? 'bg-blue-500 text-white' :
                  dayOfWeek === 0 ? 'text-red-400' :
                  dayOfWeek === 6 ? 'text-blue-400' :
                  'text-slate-700'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {de.slice(0, 5).map(event => {
                    const pc = PERSON_COLORS[event.person]
                    const isStart = event.date === dateStr
                    const isEnd = (event.end_date || event.date) === dateStr
                    const label = `${event.title}${event.time ? ' ' + formatKoreanTime(event.time) : ''}`
                    return (
                      <div key={event.id} className={`text-[20px] px-1 py-0.5 truncate ${pc.bg} ${pc.text} ${isStart ? 'rounded-l' : '-ml-1'} ${isEnd ? 'rounded-r' : '-mr-1'}`}>
                        {isStart ? label : ' '}
                      </div>
                    )
                  })}
                  {de.length > 5 && (
                    <div className="text-[20px] text-slate-400 px-1">+{de.length - 5}</div>
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
            <span className="text-[20px] text-slate-500">{pc.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day panel */}
      {selectedDate && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-[28px]">
              {format(new Date(selectedDate), 'M월 d일 (EEEE)', { locale: ko })}
            </h3>
            <button
              onClick={openAdd}
              className="flex items-center gap-1 bg-blue-500 text-white text-[20px] px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={20} /> 일정 추가
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-[20px] text-slate-400 py-2">일정이 없어요. 추가해보세요!</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(event => {
                const pc = PERSON_COLORS[event.person]
                return (
                  <div key={event.id} onDoubleClick={() => openEdit(event)}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer group ${pc.bg}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-[24px] font-medium ${pc.text}`}>{event.title}</p>
                        {event.time && <p className="text-[20px] text-slate-500">{formatKoreanTime(event.time)}</p>}
                      </div>
                      {event.end_date && <p className="text-[18px] text-slate-500 mt-0.5">~ {event.end_date}</p>}
                      {event.note && <p className="text-[18px] text-slate-500 mt-0.5">{event.note}</p>}
                      {event.file_url && (
                        <a href={event.file_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="text-[18px] text-blue-500 hover:underline mt-0.5 inline-flex items-center gap-1">
                          <Paperclip size={16} /> 첨부파일
                        </a>
                      )}
                      <span className={`text-[16px] mt-1 inline-block px-1.5 py-0.5 rounded-full ${pc.text} bg-white/60`}>{pc.label}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <label className="opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400 hover:text-blue-400 transition-all">
                        <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, event.id) }} />
                        <Paperclip size={20} />
                      </label>
                      <button onClick={() => handleDelete(event.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add/edit event modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{editItem ? '일정 수정' : '일정 추가'}</h3>
              <button onClick={() => { setShowModal(false); setEditItem(null) }}><X size={20} className="text-slate-400" /></button>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">시작일</label>
                  <DatePickerInput value={selectedDate || ''} onChange={v => setSelectedDate(v)} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">종료일 (선택)</label>
                  <DatePickerInput value={form.end_date} onChange={v => setForm(f => ({ ...f, end_date: v }))} className="w-full" />
                </div>
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
              {/* File upload - only for existing events */}
              {editItem && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">첨부파일</label>
                  {editItem.file_url && (
                    <a href={editItem.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline block mb-1">📎 현재 첨부파일</a>
                  )}
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f && editItem) handleFileUpload(f, editItem.id) }} />
                    <span className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      {uploading ? '업로드 중...' : '파일 첨부'}
                    </span>
                  </label>
                </div>
              )}
              {editItem && (
                <button onClick={() => handleDelete(editItem.id)}
                  className="w-full border border-red-200 text-red-400 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">
                  삭제
                </button>
              )}
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
