import { NextResponse } from 'next/server'
import { GOOGLE_SCOPE, redirectUri } from '@/lib/google'

// 구글 로그인(동의) 화면으로 리다이렉트.
// 앱에서 "구글 캘린더 연결" 버튼이 이 주소로 이동시킨다.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID 미설정' }, { status: 500 })
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent', // refresh_token 을 확실히 받기 위해
  })
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
