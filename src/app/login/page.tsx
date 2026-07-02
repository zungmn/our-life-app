'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true); setError('')
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, pw }) })
    const j = await res.json()
    if (!res.ok) { setError(j.error || '로그인 실패'); setLoading(false); return }
    // 로그인한 사람 기준으로 기본 화면(Eddy/Judy) 설정
    if (j.viewer) { localStorage.setItem('viewer', j.viewer); window.dispatchEvent(new CustomEvent('viewer-change')) }
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold text-slate-800">🏠 우리 집</h1>
          <p className="text-xs text-slate-400 mt-1">Eddy &amp; Judy · 로그인</p>
        </div>
        <div className="space-y-3">
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            placeholder="아이디" value={id} onChange={e => setId(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          <input type="password" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={submit} disabled={loading || !id || !pw}
            className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50">
            {loading ? '확인 중...' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  )
}
