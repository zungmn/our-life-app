import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const secret = process.env.APP_SESSION_SECRET
  const id = process.env.APP_ID
  const pw = process.env.APP_PW
  if (!secret || !id || !pw) {
    return NextResponse.json({ error: '로그인이 설정되지 않았습니다. (환경변수 미설정)' }, { status: 500 })
  }
  let body: { id?: string; pw?: string } = {}
  try { body = await req.json() } catch {}
  if (body.id !== id || body.pw !== pw) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', secret, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30일
  })
  return res
}
