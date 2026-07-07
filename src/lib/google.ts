import { createClient } from '@supabase/supabase-js'

// 서버 전용 Supabase 클라이언트
export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export type GoogleAuth = {
  refresh_token?: string
  calendar_id?: string
  sync_token?: string
  connected_at?: string
}

const AUTH_KEY = 'google_auth'

export async function getGoogleAuth(): Promise<GoogleAuth> {
  const { data } = await admin().from('app_state').select('value').eq('key', AUTH_KEY).maybeSingle()
  return (data?.value as GoogleAuth) || {}
}
export async function setGoogleAuth(patch: Partial<GoogleAuth>) {
  const cur = await getGoogleAuth()
  const next = { ...cur, ...patch }
  await admin().from('app_state').upsert({ key: AUTH_KEY, value: next })
  return next
}

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar'

export function redirectUri(req: Request) {
  // 배포 URL 기준 콜백. 명시 환경변수가 있으면 우선.
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI
  const origin = new URL(req.url).origin
  return `${origin}/api/google/callback`
}

// refresh_token 으로 access_token 발급
export async function getAccessToken(refresh: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  })
  const j = await res.json()
  if (!j.access_token) throw new Error('access_token 발급 실패: ' + JSON.stringify(j))
  return j.access_token as string
}

// "우리 집" 전용 캘린더 확보 (없으면 생성)
export async function ensureCalendar(token: string, existing?: string): Promise<string> {
  if (existing) return existing
  // 이름으로 기존 검색
  const list = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())
  const found = (list.items || []).find((c: { summary?: string; id: string }) => c.summary === '우리 집')
  if (found) return found.id
  const created = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: '우리 집', timeZone: 'Asia/Seoul' }),
  }).then(r => r.json())
  return created.id
}
