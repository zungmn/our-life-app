import { NextResponse } from 'next/server'

// 치과 OS(gybonplant-os)에서 매출을 가져오는 서버 프록시.
// 브라우저가 아닌 서버에서 호출하므로 CORS 문제 없고, 비밀키도 노출되지 않는다.
// Vercel 환경변수 필요:
//   CLINIC_OS_URL  = https://gybonplant-os.vercel.app
//   CLINIC_OS_KEY  = (OS와 약속한 비밀 문자열)
export async function GET(req: Request) {
  const url = process.env.CLINIC_OS_URL
  const key = process.env.CLINIC_OS_KEY
  if (!url) return NextResponse.json({ error: 'CLINIC_OS_URL 미설정' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')   // YYYY-MM-DD (오늘 일매출)
  const month = searchParams.get('month') // YYYY-MM   (이번 달 합계)
  const qs = month ? `month=${month}` : `date=${date || new Date().toISOString().slice(0, 10)}`

  try {
    const res = await fetch(`${url}/api/daily-revenue?${qs}`, {
      headers: key ? { 'x-api-key': key } : {},
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ error: `OS 응답 오류 (${res.status})` }, { status: 502 })
    const data = await res.json()
    const total = Number(data.total ?? data.revenue ?? 0)
    return NextResponse.json({ total, raw: data })
  } catch (e) {
    return NextResponse.json({ error: '치과 OS 연결 실패: ' + String(e) }, { status: 502 })
  }
}
