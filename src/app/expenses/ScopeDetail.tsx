'use client'

import { useMemo, useState } from 'react'
import { catColorOf2 } from '@/lib/constants'

export type SItem = { date: string; amount: number; type: 'income' | 'expense'; memo?: string; category: string; scope: string; is_saving: boolean }

const won = (n: number) => (n < 0 ? '-' : '') + (Math.abs(n) >= 10000 ? Math.round(Math.abs(n) / 10000).toLocaleString() + '만' : Math.abs(n).toLocaleString())
const fmt = (n: number) => n.toLocaleString() + '원'
const mergeRent = (c: string) => (c === '관리비' || c === '임대료') ? '임대료+관리비' : c
const colorFor = (name: string) => catColorOf2(name === '임대료+관리비' ? '임대료' : name)
const pct = (v: number, base: number) => base > 0 ? Math.round(v / base * 1000) / 10 : 0

const LABEL: Record<string, string> = { hospital: '병원 경비', household: '가계', saving: '저축' }

// 'YYYY-MM' 에서 n개월 전 키 목록
function prevMonths(m: string, n: number) {
  const [y, mo] = m.split('-').map(Number)
  const arr: string[] = []
  for (let i = 1; i <= n; i++) { const d = new Date(y, mo - 1 - i, 1); arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  return arr
}

type Insight = { kind: 'up' | 'down' | 'new' | 'info' | 'top'; tag: string; body: string }

export default function ScopeDetail({ scope, items, revenueMonth }: {
  scope: 'hospital' | 'household' | 'saving'
  items: SItem[]
  revenueMonth: (k: string) => number
}) {
  const [view, setView] = useState<'month' | 'year'>('month')
  const [selMonth, setSelMonth] = useState<string | null>(null)
  const [selYear, setSelYear] = useState<string | null>(null)
  const isSaving = scope === 'saving'
  const flow = isSaving ? '저축' : '지출'

  const mine = useMemo(() => items.filter(i =>
    i.type === 'expense' && (isSaving ? i.is_saving : (!i.is_saving && i.scope === scope))
  ), [items, scope, isSaving])

  const catOf = (i: SItem) => scope === 'hospital' ? mergeRent(i.category) : (i.category || '기타')

  // 집계: 월별/연도별 × 카테고리
  const { byMonth, byYear, monthKeys, yearKeys, grandTotal, byCatAll } = useMemo(() => {
    const bm: Record<string, Record<string, number>> = {}
    const by: Record<string, Record<string, number>> = {}
    const ca: Record<string, number> = {}
    let g = 0
    for (const i of mine) {
      const m = i.date.slice(0, 7), y = i.date.slice(0, 4), c = catOf(i)
      ;(bm[m] ||= {})[c] = (bm[m][c] || 0) + i.amount
      ;(by[y] ||= {})[c] = (by[y][c] || 0) + i.amount
      ca[c] = (ca[c] || 0) + i.amount
      g += i.amount
    }
    return {
      byMonth: bm, byYear: by,
      monthKeys: Object.keys(bm).sort().reverse(),
      yearKeys: Object.keys(by).sort().reverse(),
      grandTotal: g,
      byCatAll: Object.entries(ca).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, scope])

  const totalOf = (obj?: Record<string, number>) => Object.values(obj || {}).reduce((s, v) => s + v, 0)

  const curMonth = (selMonth && monthKeys.includes(selMonth)) ? selMonth : monthKeys[0]
  const curYear = (selYear && yearKeys.includes(selYear)) ? selYear : yearKeys[0]

  // ── 월별 상세 + 비교(6개월평균 / 작년동월) ──
  const monthDetail = useMemo(() => {
    if (!curMonth) return null
    const cur = byMonth[curMonth] || {}
    const p6 = prevMonths(curMonth, 6)
    const [y, mm] = curMonth.split('-')
    const lyKey = `${Number(y) - 1}-${mm}`
    const ly = byMonth[lyKey] || {}
    const names = new Set([...Object.keys(cur), ...p6.flatMap(k => Object.keys(byMonth[k] || {}))])
    const rows = [...names].map(name => {
      const c = cur[name] || 0
      const avg6 = Math.round(p6.reduce((s, k) => s + (byMonth[k]?.[name] || 0), 0) / 6)
      return { name, cur: c, avg6, ly: ly[name] || 0, color: colorFor(name) }
    }).filter(r => r.cur > 0 || r.avg6 > 0).sort((a, b) => b.cur - a.cur)
    const total = totalOf(cur)
    const avg6Total = Math.round(p6.reduce((s, k) => s + totalOf(byMonth[k]), 0) / 6)
    const lyTotal = totalOf(ly)
    const rev = revenueMonth(curMonth)
    return { rows, total, avg6Total, lyTotal, rev }
  }, [curMonth, byMonth, revenueMonth])

  // ── 연도별 상세 + 비교(작년) ──
  const yearDetail = useMemo(() => {
    if (!curYear) return null
    const cur = byYear[curYear] || {}
    const prev = byYear[String(Number(curYear) - 1)] || {}
    const names = new Set([...Object.keys(cur), ...Object.keys(prev)])
    const rows = [...names].map(name => ({ name, cur: cur[name] || 0, prev: prev[name] || 0, color: colorFor(name) }))
      .filter(r => r.cur > 0 || r.prev > 0).sort((a, b) => b.cur - a.cur)
    // 올해 최대 단일 지출
    const yearItems = mine.filter(i => i.date.slice(0, 4) === curYear).sort((a, b) => b.amount - a.amount)
    const biggest = yearItems[0]
    return { rows, total: totalOf(cur), prevTotal: totalOf(prev), biggest }
  }, [curYear, byYear, mine])

  // ── 인사이트 생성 (세무·회계 전문가 톤, 규칙 기반) ──
  const monthInsights: Insight[] = useMemo(() => {
    if (!monthDetail) return []
    const { rows, total, avg6Total, lyTotal } = monthDetail
    const out: Insight[] = []
    const thr = Math.max(total * 0.03, isSaving ? 100000 : 200000)
    if (rows[0] && rows[0].cur > 0) out.push({ kind: 'top', tag: rows[0].name, body: `이번 달 ${LABEL[scope]} 중 가장 큰 항목입니다. ${fmt(rows[0].cur)} (전체의 ${pct(rows[0].cur, total)}%).` })
    // 신규
    for (const r of rows) {
      if (r.avg6 < thr * 0.25 && r.cur >= thr) out.push({ kind: 'new', tag: r.name, body: isSaving ? `그동안 없던 종목에 이번 달 새로 ${fmt(r.cur)} 저축했습니다.` : `그동안 거의 없던 지출이 이번 달 새로 ${fmt(r.cur)} 발생했습니다. 일회성인지 확인이 필요합니다.` })
    }
    // 급증
    for (const r of rows) {
      if (r.avg6 >= thr && r.cur >= r.avg6 * 1.4 && r.cur - r.avg6 >= thr * 0.5) out.push({ kind: 'up', tag: r.name, body: `평소(6개월 평균 ${won(r.avg6)})보다 ${pct(r.cur - r.avg6, r.avg6)}% 늘어 ${fmt(r.cur)}입니다.` })
    }
    // 급감
    for (const r of rows) {
      if (r.avg6 >= thr && r.cur <= r.avg6 * 0.5) out.push({ kind: 'down', tag: r.name, body: `평소(6개월 평균 ${won(r.avg6)})보다 크게 줄어 ${fmt(r.cur)}입니다.` })
    }
    // 작년 동월 신규 비교(경비/가계): 작년엔 없던 항목
    if (!isSaving) for (const r of rows.slice(0, 12)) {
      if (r.ly < thr * 0.25 && r.cur >= thr && r.avg6 >= thr) { /* 이미 위에서 다룸 */ }
    }
    // 총액 요약
    const parts: string[] = []
    if (avg6Total > 0) parts.push(`6개월 평균 대비 ${pct(total - avg6Total, avg6Total) >= 0 ? '+' : ''}${pct(total - avg6Total, avg6Total)}%`)
    if (lyTotal > 0) parts.push(`작년 동월 대비 ${pct(total - lyTotal, lyTotal) >= 0 ? '+' : ''}${pct(total - lyTotal, lyTotal)}%`)
    out.push({ kind: 'info', tag: '총 ' + LABEL[scope], body: `${fmt(total)}${parts.length ? ' · ' + parts.join(', ') : ''}${scope === 'hospital' && monthDetail.rev > 0 ? ` · 매출 대비 경비율 ${pct(total, monthDetail.rev)}%` : ''}` })
    return out.slice(0, 8)
  }, [monthDetail, scope, isSaving])

  const yearInsights: Insight[] = useMemo(() => {
    if (!yearDetail) return []
    const { rows, total, prevTotal, biggest } = yearDetail
    const out: Insight[] = []
    if (rows[0] && rows[0].cur > 0) out.push({ kind: 'top', tag: rows[0].name, body: `올해 ${LABEL[scope]} 중 가장 큰 항목입니다. ${fmt(rows[0].cur)} (전체의 ${pct(rows[0].cur, total)}%).` })
    if (biggest && biggest.amount >= total * 0.1) out.push({ kind: 'new', tag: biggest.memo || biggest.category || '단일 지출', body: `올해 가장 큰 단일 ${flow}입니다. ${fmt(biggest.amount)} (${biggest.date}). 이런 큰 건이 그 해 총액을 끌어올립니다.` })
    // 작년 대비 급증 항목
    for (const r of rows.slice(0, 12)) {
      const prev = r.prev
      if (r.cur >= Math.max(total * 0.05, 1000000) && r.cur >= prev * 1.5 && r.cur - prev >= 1000000)
        out.push({ kind: 'up', tag: r.name, body: `작년(${won(prev)})보다 크게 늘어 ${fmt(r.cur)}입니다.` })
    }
    if (prevTotal > 0) out.push({ kind: 'info', tag: `${curYear}년 총 ${LABEL[scope]}`, body: `${fmt(total)} · 작년(${won(prevTotal)}) 대비 ${pct(total - prevTotal, prevTotal) >= 0 ? '+' : ''}${pct(total - prevTotal, prevTotal)}%` })
    return out.slice(0, 8)
  }, [yearDetail, scope, curYear, flow])

  const KIND_STYLE: Record<Insight['kind'], { bg: string; badge: string; icon: string }> = {
    top: { bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-600', icon: '🏆' },
    up: { bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-600', icon: '📈' },
    down: { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-600', icon: '📉' },
    new: { bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', icon: '✨' },
    info: { bg: 'bg-slate-50', badge: 'bg-slate-200 text-slate-600', icon: '📊' },
  }

  const InsightCards = ({ list }: { list: Insight[] }) => (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">💡 인사이트 (세무·회계 관점)</h4>
      {list.length === 0 ? <p className="text-sm text-slate-400">표시할 인사이트가 없어요.</p> : (
        <div className="grid sm:grid-cols-2 gap-2">
          {list.map((ins, i) => (
            <div key={i} className={`rounded-lg p-3 ${KIND_STYLE[ins.kind].bg}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span>{KIND_STYLE[ins.kind].icon}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${KIND_STYLE[ins.kind].badge}`}>{ins.tag}</span>
              </div>
              <p className="text-[13px] text-slate-700 leading-relaxed">{ins.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const Bars = ({ rows, totalForPct }: { rows: { name: string; cur: number; color: string }[]; totalForPct: number }) => (
    <div className="space-y-1.5">
      {rows.length === 0 ? <p className="text-sm text-slate-400">내역이 없어요.</p> : rows.map(r => (
        <div key={r.name} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
          <span className="text-slate-600 flex-1 truncate">{r.name}</span>
          <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
            <div className="h-full rounded-full" style={{ width: `${pct(r.cur, totalForPct)}%`, background: r.color }} />
          </div>
          <span className="text-slate-700 font-medium w-20 text-right">{fmt(r.cur)}</span>
          <span className="text-slate-400 w-12 text-right text-xs">{pct(r.cur, totalForPct)}%</span>
        </div>
      ))}
    </div>
  )

  const empty = mine.length === 0

  return (
    <div className="space-y-4">
      {/* 월별 / 연도별 토글 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {([['month', '월별'], ['year', '연도별']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${view === k ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        {isSaving && <span className="text-sm text-slate-500">총 저축(누적) <b className="text-indigo-600">{fmt(grandTotal)}</b></span>}
      </div>

      {empty ? (
        <p className="text-sm text-slate-400 py-8 text-center">아직 {LABEL[scope]} 내역이 없어요.</p>
      ) : view === 'month' ? (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {monthKeys.slice(0, 18).map(k => (
              <button key={k} onClick={() => setSelMonth(k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${curMonth === k ? 'bg-indigo-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
                {k.slice(2, 4)}.{k.slice(5, 7)}
              </button>
            ))}
          </div>
          {monthDetail && (
            <div className="grid lg:grid-cols-2 gap-4">
              {/* 항목별 + 비교표 */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">{curMonth.slice(0, 4)}년 {parseInt(curMonth.slice(5, 7))}월 · 항목별 {flow}</h4>
                  <span className="text-sm font-bold text-slate-800">{fmt(monthDetail.total)}</span>
                </div>
                <Bars rows={monthDetail.rows} totalForPct={monthDetail.total} />
                {/* 비교표 */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-400">항목</span>
                    <span className="text-slate-400 text-right w-16">이번달</span>
                    <span className="text-slate-400 text-right w-16">6M평균</span>
                    <span className="text-slate-400 text-right w-16">작년동월</span>
                    {monthDetail.rows.slice(0, 8).map(r => (
                      <ContextRow key={r.name} name={r.name} cur={r.cur} a={r.avg6} b={r.ly} />
                    ))}
                  </div>
                </div>
              </div>
              <InsightCards list={monthInsights} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {yearKeys.map(k => (
              <button key={k} onClick={() => setSelYear(k)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${curYear === k ? 'bg-indigo-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>{k}년</button>
            ))}
          </div>
          {yearDetail && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">{curYear}년 · 항목별 {flow}</h4>
                  <span className="text-sm font-bold text-slate-800">{fmt(yearDetail.total)}</span>
                </div>
                <Bars rows={yearDetail.rows} totalForPct={yearDetail.total} />
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-400">항목</span>
                    <span className="text-slate-400 text-right w-16">올해</span>
                    <span className="text-slate-400 text-right w-16">작년</span>
                    {yearDetail.rows.slice(0, 10).map(r => (
                      <ContextRow key={r.name} name={r.name} cur={r.cur} a={r.prev} />
                    ))}
                  </div>
                </div>
              </div>
              <InsightCards list={yearInsights} />
            </div>
          )}
        </>
      )}

      {/* 저축: 종목별 누적 (전체) */}
      {isSaving && !empty && (
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">종목별 누적 저축 (전체 기간)</h4>
          <Bars rows={byCatAll.map(c => ({ name: c.name, cur: c.value, color: colorFor(c.name) }))} totalForPct={grandTotal} />
          <p className="text-[11px] text-slate-400 mt-2">※ 위 금액은 <b>납입한 누적액</b>입니다. 종목별 <b>현재 평가액</b>(수익률 반영)까지 보고 싶으시면 알려주세요 — 평가액 입력 기능을 추가해 드릴게요.</p>
        </div>
      )}
    </div>
  )
}

function ContextRow({ name, cur, a, b }: { name: string; cur: number; a: number; b?: number }) {
  const arrow = (v: number, base: number) => {
    if (base <= 0) return <span className="text-slate-300">–</span>
    const d = Math.round((v - base) / base * 1000) / 10
    return <span className={d > 0 ? 'text-rose-500' : d < 0 ? 'text-blue-500' : 'text-slate-400'}>{d > 0 ? '▲' : d < 0 ? '▼' : ''}{Math.abs(d)}%</span>
  }
  return (
    <>
      <span className="text-slate-600 truncate">{name}</span>
      <span className="text-right w-16 text-slate-700">{cur ? Math.round(cur / 10000).toLocaleString() + '만' : '-'}</span>
      <span className="text-right w-16 text-slate-500">{a ? Math.round(a / 10000).toLocaleString() + '만' : '-'} <span className="text-[10px]">{arrow(cur, a)}</span></span>
      {b !== undefined && <span className="text-right w-16 text-slate-500">{b ? Math.round(b / 10000).toLocaleString() + '만' : '-'} <span className="text-[10px]">{arrow(cur, b)}</span></span>}
    </>
  )
}
