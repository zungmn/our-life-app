// korean-lunar-calendar wrapper for lunar→solar date conversion
// eslint-disable-next-line @typescript-eslint/no-require-imports
const KoreanLunarCalendar = require('korean-lunar-calendar')

export function lunarToSolar(year: number, lunarMonth: number, lunarDay: number): { year: number; month: number; day: number } | null {
  try {
    const calendar = new KoreanLunarCalendar()
    calendar.setLunarDate(year, lunarMonth, lunarDay, false)
    const solar = calendar.getSolarCalendar()
    if (solar && solar.year && solar.month && solar.day) {
      return { year: solar.year, month: solar.month, day: solar.day }
    }
    return null
  } catch {
    return null
  }
}

export function lunarToSolarDateString(year: number, lunarMM: string, lunarDD: string): string | null {
  const m = parseInt(lunarMM, 10)
  const d = parseInt(lunarDD, 10)
  const result = lunarToSolar(year, m, d)
  if (!result) return null
  return `${result.year}-${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}`
}
