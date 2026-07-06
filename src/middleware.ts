import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 로그인 게이트: APP_SESSION_SECRET 환경변수가 설정된 경우에만 작동한다.
// (미설정 시 잠금 없이 통과 → 배포 직후 잠기는 사고 방지)
export function middleware(req: NextRequest) {
  const secret = process.env.APP_SESSION_SECRET
  const { pathname } = req.nextUrl
  // 위젯 API(/api/widget)는 자체 WIDGET_KEY 토큰으로 보호되므로 로그인 게이트에서 제외
  const isPublic = pathname === '/login' || pathname.startsWith('/api/login') || pathname.startsWith('/api/logout') || pathname.startsWith('/api/widget')

  let res: NextResponse
  if (!secret) {
    res = NextResponse.next()
  } else {
    const authed = req.cookies.get('session')?.value === secret
    if (!authed && !isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      res = NextResponse.redirect(url)
    } else if (authed && pathname === '/login') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      res = NextResponse.redirect(url)
    } else {
      res = NextResponse.next()
    }
  }
  // 검색엔진 노출 방지
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
}
