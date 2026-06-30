// 대한민국 법정 공휴일 계산 (양력 고정 + 음력 + 대체공휴일)
// 음력 변환은 korean-lunar-calendar 사용. 2023~2029년 등 임의 연도에 대해 계산되므로
// 별도 갱신 없이 항상 최신 규정(현행 대체공휴일법)을 따른다.

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const dow = (s: string) => new Date(s + 'T00:00:00').getDay() // 0=일 ... 6=토
const addDay = (s: string, n: number) => {
  const dt = new Date(s + 'T00:00:00'); dt.setDate(dt.getDate() + n)
  return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function lunarToSolar(y: number, m: number, d: number): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const KLC = require('korean-lunar-calendar')
    const cal = new KLC()
    cal.setLunarDate(y, m, d, false)
    const s = cal.getSolarCalendar()
    if (!s || !s.year) return null
    return ymd(s.year, s.month, s.day)
  } catch { return null }
}

// 대체공휴일 미적용 (신정, 현충일)
const NO_SUBSTITUTE = new Set(['신정', '현충일'])

function buildYear(year: number): Record<string, string> {
  const base: { date: string; name: string }[] = []
  const push = (date: string | null, name: string) => { if (date) base.push({ date, name }) }

  // 양력 고정
  push(ymd(year, 1, 1), '신정')
  push(ymd(year, 3, 1), '삼일절')
  push(ymd(year, 5, 5), '어린이날')
  push(ymd(year, 6, 6), '현충일')
  if (year >= 2026) push(ymd(year, 7, 17), '제헌절') // 2026년 공휴일 재지정
  push(ymd(year, 8, 15), '광복절')
  push(ymd(year, 10, 3), '개천절')
  push(ymd(year, 10, 9), '한글날')
  push(ymd(year, 12, 25), '성탄절')

  // 음력: 설날 연휴(전날·당일·다음날)
  const seol = lunarToSolar(year, 1, 1)
  if (seol) { push(addDay(seol, -1), '설날 연휴'); push(seol, '설날'); push(addDay(seol, 1), '설날 연휴') }
  // 부처님오신날 (음력 4/8)
  push(lunarToSolar(year, 4, 8), '부처님오신날')
  // 추석 연휴(전날·당일·다음날)
  const chu = lunarToSolar(year, 8, 15)
  if (chu) { push(addDay(chu, -1), '추석 연휴'); push(chu, '추석'); push(addDay(chu, 1), '추석 연휴') }

  // 맵 구성
  const map: Record<string, string> = {}
  for (const h of base) if (!map[h.date]) map[h.date] = h.name

  // 대체공휴일: 일요일/토요일/공휴일 중복 시 다음 평일로 이월
  const occupied = new Set(Object.keys(map))
  const subs: { date: string; name: string }[] = []
  // 설/추석은 토요일은 대체 제외(일요일/공휴일 겹침만), 그 외 어린이날 등은 토·일 모두
  for (const h of base) {
    if (NO_SUBSTITUTE.has(h.name)) continue
    const isSeolChu = h.name.startsWith('설날') || h.name.startsWith('추석')
    const wd = dow(h.date)
    const overlaps = base.filter(b => b.date === h.date && b.name !== h.name).length > 0
    const trigger = isSeolChu ? (wd === 0 || overlaps) : (wd === 0 || wd === 6 || overlaps)
    if (!trigger) continue
    // 다음 평일이면서 비어있는 날 찾기
    let cand = addDay(h.date, 1)
    while (dow(cand) === 0 || dow(cand) === 6 || occupied.has(cand)) cand = addDay(cand, 1)
    occupied.add(cand)
    subs.push({ date: cand, name: '대체공휴일' })
  }
  for (const s of subs) if (!map[s.date]) map[s.date] = s.name
  return map
}

const cache: Record<number, Record<string, string>> = {}
export function holidaysForYear(year: number): Record<string, string> {
  if (!cache[year]) cache[year] = buildYear(year)
  return cache[year]
}

// 여러 해(보통 그리드가 걸치는 전/현/다음 연도) 공휴일 맵
export function holidaysForYears(years: number[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const y of years) Object.assign(out, holidaysForYear(y))
  return out
}
