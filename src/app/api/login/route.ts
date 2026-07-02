import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const secret = process.env.APP_SESSION_SECRET
  if (!secret) {
    return NextResponse.json({ error: '로그인이 설정되지 않았습니다. (환경변수 미설정)' }, { status: 500 })
  }
  // Eddy / Judy 두 계정
  const accounts = [
    { id: process.env.APP_ID, pw: process.env.APP_PW, viewer: 'eddy' },
    { id: process.env.APP_ID_JUDY, pw: process.env.APP_PW_JUDY, viewer: 'judy' },
  ]
  let body: { id?: string; pw?: string } = {}
  try { body = await req.json() } catch {}
  const match = accounts.find(a => a.id && a.pw && body.id === a.id && body.pw === a.pw)
  if (!match) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true, viewer: match.viewer })
  res.cookies.set('session', secret, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30일
  })
  return res
}
