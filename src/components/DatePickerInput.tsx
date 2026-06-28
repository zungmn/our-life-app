'use client'
import { useState } from 'react'
import DateInput from './DateInput'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
}

export default function DatePickerInput({ value, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const safeDate = value && value.length >= 7 ? new Date(value.slice(0, 7) + '-01') : new Date()
  const [calMonth, setCalMonth] = useState(safeDate)

  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)

  const selectDay = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-1">
        <DateInput value={value} onChange={onChange} className="flex-1" />
        <button type="button" onClick={() => setOpen(o => !o)}
          className="px-2.5 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors flex-shrink-0 flex items-center">
          <Calendar size={14} />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-96">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setCalMonth(subMonths(calMonth, 1))}
                className="p-1.5 hover:bg-slate-100 rounded transition-colors">
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
              <span className="text-sm font-semibold text-slate-700">{format(calMonth, 'yyyy년 M월')}</span>
              <button type="button" onClick={() => setCalMonth(addMonths(calMonth, 1))}
                className="p-1.5 hover:bg-slate-100 rounded transition-colors">
                <ChevronRight size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1.5">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {Array(startPad).fill(null).map((_, i) => <div key={`p${i}`} />)}
              {days.map(day => {
                const ds = format(day, 'yyyy-MM-dd')
                const isSelected = ds === value
                const dow = getDay(day)
                return (
                  <button key={ds} type="button" onClick={() => selectDay(day)}
                    className={`text-sm w-full aspect-square rounded-lg flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-blue-500 text-white font-bold' :
                      dow === 0 ? 'text-red-400 hover:bg-red-50' :
                      dow === 6 ? 'text-blue-400 hover:bg-blue-50' :
                      'text-slate-700 hover:bg-slate-100'
                    }`}>
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
