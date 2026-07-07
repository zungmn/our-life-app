import { NextResponse } from 'next/server'
import { redirectUri, setGoogleAuth, ensureCalendar } from '@/lib/google'

// 구글 동의 후 콜백: code → refresh_token 교환하여 저장하고, "우리 집" 캘린더 확보.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(`${origin}/calendar?google=error`)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(req),
    }),
  })
  const j = await res.json()
  if (!j.access_token) {
    return NextResponse.redirect(`${origin}/calendar?google=error`)
  }
  const calendar_id = await ensureCalendar(j.access_token)
  await setGoogleAuth({
    ...(j.refresh_token ? { refresh_token: j.refresh_token } : {}),
    calendar_id,
    connected_at: new Date().toISOString(),
    sync_token: undefined, // 재연결 시 전체 다시 동기화
  })
  return NextResponse.redirect(`${origin}/calendar?google=connected`)
}
