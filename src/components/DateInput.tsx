'use client'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
}

export default function DateInput({ value, onChange, className = '' }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^0-9]/g, '')
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4)
    if (v.length > 7) v = v.slice(0, 7) + '-' + v.slice(7)
    if (v.length > 10) v = v.slice(0, 10)
    onChange(v)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="YYYY-MM-DD"
      value={value}
      onChange={handleChange}
      className={`border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 ${className}`}
    />
  )
}
