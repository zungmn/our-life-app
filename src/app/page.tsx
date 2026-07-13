import { redirect } from 'next/navigation'

// Home·Todo·Project·Calendar 페이지는 제거됨(구글 캘린더로 대체).
// 루트 접속 시 Budget 페이지로 이동.
export default function Page() {
  redirect('/expenses')
}
