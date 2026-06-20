import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const BOOKS = [
  { title: '기억 안아주기', author: '최연호', cover_url: 'https://bookthumb-phinf.pstatic.net/cover/175/265/17526519.jpg?udate=20210513', status: 'completed', rating: 5, date_started: '2022-02-22', date_finished: '2022-11-09' },
  { title: '남편 성격만 알아도 행복해진다', author: '송지혜, 이백용', cover_url: 'https://bookthumb-phinf.pstatic.net/cover/029/563/02956364.jpg?type=m140&udate=20070704', status: 'completed', rating: 4, date_started: '2021-10-01', date_finished: '2021-12-31' },
  { title: '나는 매주 시체를 보러간다', author: '유성호', cover_url: 'https://bookthumb-phinf.pstatic.net/cover/144/679/14467912.jpg?udate=20210408', status: 'completed', rating: 2, date_started: '2019-05-06', date_finished: '2019-06-06' },
  { title: '지구에서 한아뿐', author: '정세랑', cover_url: null, status: 'completed', rating: 4, date_started: '2022-07-09', date_finished: '2022-07-10' },
  { title: '스몰 스텝', author: '박요철', cover_url: null, status: 'completed', rating: 5, date_started: '2022-07-31', date_finished: '2022-08-05' },
  { title: '하루 10분 인문학', author: '이준형, 지일주', cover_url: null, status: 'completed', rating: 1, date_started: '2022-08-06', date_finished: '2022-08-15' },
  { title: '의사의 속마음', author: '나카야마 유지로', cover_url: null, status: 'completed', rating: 5, date_started: '2022-08-15', date_finished: '2022-08-21' },
  { title: '츠바키 문구점', author: '오가와 이토', cover_url: null, status: 'completed', rating: 3, date_started: '2022-08-21', date_finished: '2022-09-01' },
  { title: '업무와 일상을 정리하는 새로운 방법 노션 Notion', author: '이해봄, 전시진', cover_url: null, status: 'completed', rating: 2, date_started: '2022-09-02', date_finished: '2022-09-11' },
  { title: '된다! 하루 5분 노션 활용법', author: '이다슬', cover_url: null, status: 'completed', rating: 2, date_started: '2022-09-12', date_finished: '2022-09-14' },
  { title: '일잘러는 노션으로 일합니다', author: '김대중', cover_url: null, status: 'completed', rating: 1, date_started: '2022-09-14', date_finished: '2022-09-15' },
  { title: '나를 살리는 말들', author: '이서원', cover_url: null, status: 'want_to_read', rating: null, date_started: '2022-09-18', date_finished: null },
  { title: '창업가의 습관', author: '이상훈', cover_url: null, status: 'completed', rating: 5, date_started: '2022-09-18', date_finished: '2022-10-09' },
  { title: '시선으로부터,', author: '정세랑', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788954672214.jpg', status: 'completed', rating: 2, date_started: '2022-10-09', date_finished: '2022-10-21' },
  { title: '내 품격을 높이는 우리말 사용 설명서', author: '이미숙', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788962451825.jpg', status: 'completed', rating: 4, date_started: '2022-10-26', date_finished: '2022-11-04' },
  { title: '아비투스', author: '도리스 메르틴', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791130630762.jpg', status: 'completed', rating: 5, date_started: '2022-11-09', date_finished: '2022-12-18' },
  { title: '행복의 정복', author: '버트런드 러셀', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788956025513.jpg', status: 'want_to_read', rating: null, date_started: '2022-12-19', date_finished: null },
  { title: '결혼 후 나는 더 외로워졌다', author: '송지혜, 이백용', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788969520098.jpg', status: 'completed', rating: 4, date_started: '2022-12-29', date_finished: '2023-01-01' },
  { title: '부의 추월차선 완결판', author: '엠제이 드마코', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791187444213.jpg', status: 'completed', rating: 5, date_started: '2023-01-02', date_finished: '2023-02-09' },
  { title: '마흔에 읽는 니체', author: '장재형', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791192300245.jpg', status: 'completed', rating: 5, date_started: '2023-02-10', date_finished: '2023-03-24' },
  { title: '초역 니체의 말 1', author: '프리드리히 니체', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788978496629.jpg', status: 'completed', rating: 5, date_started: '2023-03-24', date_finished: '2023-04-13' },
  { title: '초역 니체의 말 2', author: '프리드리히 니체', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788978496681.jpg', status: 'completed', rating: 4, date_started: '2023-04-13', date_finished: '2023-06-09' },
  { title: '사진 구도가 달라지는 아이디어 100', author: '문철진', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788968571374.jpg', status: 'completed', rating: 2, date_started: '2023-03-19', date_finished: '2023-03-24' },
  { title: '행복의 지도', author: '에릭 와이너', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791167740021.jpg', status: 'want_to_read', rating: null, date_started: '2023-05-17', date_finished: null },
  { title: '의료인을 위한 경영학 수업', author: '이정우', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791170680253.jpg', status: 'completed', rating: 5, date_started: '2023-08-28', date_finished: null },
  { title: '역행자', author: '자청', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788901272580.jpg', status: 'completed', rating: 4, date_started: '2023-09-03', date_finished: '2023-09-15' },
  { title: '우리, 편하게 말해요', author: '이금희', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788901264776.jpg', status: 'completed', rating: 3, date_started: '2023-09-16', date_finished: '2023-09-21' },
  { title: '핑크펭귄', author: '빌 비숍', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791195936380.jpg', status: 'completed', rating: 3, date_started: '2023-09-21', date_finished: '2023-09-28' },
  { title: '메리골드 마음 세탁', author: '윤정은', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791191891287.jpg', status: 'completed', rating: 3, date_started: '2023-09-28', date_finished: '2023-09-30' },
  { title: '사장학개론', author: '김승호', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791188331888.jpg', status: 'completed', rating: 5, date_started: '2023-10-01', date_finished: '2023-10-05' },
  { title: '말하기 수업', author: '한석준', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791168341234.jpg', status: 'completed', rating: 3, date_started: '2023-10-13', date_finished: '2023-12-22' },
  { title: '돈의 속성', author: '김승호', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791188331796.jpg', status: 'completed', rating: 4, date_started: '2023-10-05', date_finished: '2023-10-18' },
  { title: '공부머리 독서법', author: '최승필', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791196316808.jpg', status: 'completed', rating: 2, date_started: '2023-10-17', date_finished: '2023-10-31' },
  { title: '비가 오면 열리는 상점', author: '유영광', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791198173898.jpg', status: 'completed', rating: 3, date_started: '2023-11-07', date_finished: '2023-11-13' },
  { title: '생각정리스킬', author: '복주환', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791193000182.jpg', status: 'completed', rating: 3, date_started: '2023-10-29', date_finished: '2023-11-06' },
  { title: '당신의 뇌는 최적화를 원한다', author: '가바사와시온', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788965706342.jpg', status: 'completed', rating: 5, date_started: '2023-11-05', date_finished: '2023-11-24' },
  { title: '원 디시전', author: '마이크 베이어', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788947548281.jpg', status: 'completed', rating: 5, date_started: '2023-11-24', date_finished: '2023-12-16' },
  { title: '마흔에 읽는 쇼펜하우어', author: '강용수', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791192300818.jpg', status: 'completed', rating: 4, date_started: '2023-12-16', date_finished: '2024-01-03' },
  { title: '나는 4시간만 일한다', author: '팀 페리스', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791185584454.jpg', status: 'completed', rating: 3, date_started: '2024-01-03', date_finished: '2024-02-04' },
  { title: '회복탄력성', author: '김주환', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791189938772.jpg', status: 'completed', rating: 5, date_started: '2024-02-04', date_finished: '2024-03-10' },
  { title: '10배의 법칙', author: '그랜트 카돈', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788960519947.jpg', status: 'completed', rating: 5, date_started: '2024-02-09', date_finished: '2024-02-14' },
  { title: '원장님께 드리는 병원 마케팅 조언 100', author: '심진보', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791157832347.jpg', status: 'completed', rating: 2, date_started: '2024-02-22', date_finished: '2024-03-24' },
  { title: '몰입', author: '황농문', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9788925556284.jpg', status: 'completed', rating: 5, date_started: '2024-03-10', date_finished: '2024-05-25' },
  { title: '작은병원 생존마케팅', author: '김세희', cover_url: 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/9791190836845.jpg', status: 'completed', rating: 4, date_started: '2024-02-22', date_finished: '2024-08-15' },
  { title: '슬로싱킹', author: '황농문', cover_url: null, status: 'completed', rating: 2, date_started: '2024-05-25', date_finished: '2024-06-16' },
  { title: '질문의 7가지 힘', author: '도로시 리즈', cover_url: null, status: 'completed', rating: 3, date_started: '2024-06-16', date_finished: '2024-07-28' },
  { title: '데일 카네기 인간관계론', author: '데일 카네기', cover_url: null, status: 'completed', rating: 3, date_started: '2024-07-28', date_finished: '2024-09-28' },
  { title: '육일약국 갑시다', author: '김성오', cover_url: null, status: 'completed', rating: 5, date_started: '2024-09-28', date_finished: '2024-10-18' },
  { title: '존 맥스웰의 리더십 수업', author: '존 맥스웰', cover_url: null, status: 'completed', rating: 3, date_started: '2024-09-01', date_finished: '2025-03-29' },
  { title: '결국 해내는 사람들의 원칙', author: '바바라 피즈, 앨런 피즈', cover_url: null, status: 'completed', rating: 5, date_started: '2024-10-19', date_finished: '2024-11-28' },
  { title: '무조건 통하는 피드백, 강점 말하기', author: '이윤경', cover_url: null, status: 'completed', rating: 4, date_started: '2024-11-29', date_finished: '2024-12-28' },
  { title: '리더십은 재능이 아니라 스킬이다', author: '고노 에이타로', cover_url: null, status: 'completed', rating: 5, date_started: '2024-12-17', date_finished: '2025-04-24' },
  { title: '건강의 뇌과학', author: '제임스 굿윈', cover_url: null, status: 'completed', rating: 5, date_started: '2025-01-28', date_finished: '2025-05-14' },
  { title: '기분 리셋', author: '알리 압달', cover_url: null, status: 'reading', rating: null, date_started: '2025-02-11', date_finished: null },
  { title: '왜 일하는가', author: '이나모리 가즈오', cover_url: null, status: 'completed', rating: 5, date_started: '2025-03-29', date_finished: '2025-04-11' },
  { title: '왜 사업하는가', author: '이나모리 가즈오', cover_url: null, status: 'completed', rating: 2, date_started: '2025-04-12', date_finished: '2025-06-01' },
  { title: '입소문 전염병', author: '간다 마사노리', cover_url: null, status: 'reading', rating: null, date_started: '2025-05-14', date_finished: null },
  { title: '경제학 콘서트 1', author: '팀 하포드', cover_url: null, status: 'completed', rating: 2, date_started: '2025-05-14', date_finished: '2025-06-29' },
  { title: '대한민국 상위 3%의 장사법', author: '배문진', cover_url: null, status: 'completed', rating: 5, date_started: '2025-06-03', date_finished: '2025-06-22' },
  { title: '회계 이렇게 쉬웠어?', author: '고윤아', cover_url: null, status: 'completed', rating: 1, date_started: '2025-06-22', date_finished: '2025-07-07' },
  { title: '바빌론 부자들의 돈 버는 지혜', author: '조지S. 클레이슨', cover_url: null, status: 'completed', rating: 4, date_started: '2025-07-03', date_finished: '2025-07-24' },
  { title: '90일 만에 당신의 회사를 고수익 기업으로 바꿔라', author: '간다 마사노리', cover_url: null, status: 'completed', rating: 4, date_started: '2025-07-07', date_finished: '2025-08-10' },
  { title: '업무시간을 반으로 줄이는 챗GPT', author: '정태일', cover_url: null, status: 'completed', rating: 3, date_started: '2025-07-27', date_finished: '2025-08-23' },
  { title: '얼티밋 노션 가계부 박살 내기 편', author: '이석현', cover_url: null, status: 'completed', rating: 3, date_started: '2025-08-09', date_finished: '2025-08-10' },
  { title: '기록이라는 세계', author: '리니', cover_url: null, status: 'completed', rating: 2, date_started: '2025-08-23', date_finished: '2025-08-24' },
  { title: '독서는 절대 나를 배신하지 않는다', author: '사이토 다카시', cover_url: null, status: 'completed', rating: 3, date_started: '2025-08-26', date_finished: '2025-09-07' },
  { title: '마케팅 설계자', author: '러셀 브런슨', cover_url: null, status: 'completed', rating: 3, date_started: '2025-09-07', date_finished: '2025-11-03' },
  { title: '기억한다는 착각', author: '차란 란가나스', cover_url: null, status: 'completed', rating: 3, date_started: '2025-09-07', date_finished: '2025-12-28' },
  { title: '우리는 결국 부모를 떠나보낸다', author: '기시미 이치로', cover_url: null, status: 'completed', rating: 3, date_started: '2025-08-10', date_finished: '2025-09-15' },
  { title: '사업의 철학', author: '마이클 거버', cover_url: null, status: 'reading', rating: null, date_started: '2025-09-12', date_finished: null },
  { title: '관상진료학', author: '마창석', cover_url: null, status: 'completed', rating: 5, date_started: '2025-10-24', date_finished: '2025-11-28' },
  { title: '동네치과 경영 바이블', author: '김영욱 외', cover_url: null, status: 'reading', rating: null, date_started: '2025-10-22', date_finished: null },
  { title: '결핍은 우리를 어떻게 변화시키는가', author: '센딜 멀레이너선, 엘다 샤퍼', cover_url: null, status: 'completed', rating: 4, date_started: '2025-11-03', date_finished: '2026-02-01' },
  { title: '끌림의 대화', author: '김범준', cover_url: null, status: 'completed', rating: 5, date_started: '2025-11-18', date_finished: '2025-12-17' },
  { title: '라오어의 미국주식 무한매수법', author: '라오어', cover_url: null, status: 'completed', rating: 3, date_started: '2025-12-03', date_finished: '2025-12-06' },
  { title: '라오어의 미국주식 밸류 리밸런싱', author: '라오어', cover_url: null, status: 'reading', rating: null, date_started: '2025-12-06', date_finished: null },
  { title: '고객의 80%는 비싸도 구매한다', author: '무라마츠 다츠오', cover_url: null, status: 'completed', rating: 3, date_started: '2025-12-15', date_finished: '2026-01-06' },
  { title: '나는 인생에서 중요한 것만 남기기로 했다', author: '에리카 라인', cover_url: null, status: 'completed', rating: 5, date_started: '2026-02-03', date_finished: '2026-03-21' },
  { title: '돈의 심리학', author: '모건 하우절', cover_url: null, status: 'completed', rating: 4, date_started: '2026-01-07', date_finished: '2026-03-22' },
  { title: '불안', author: '알랭 드 보통', cover_url: null, status: 'reading', rating: null, date_started: '2026-03-24', date_finished: null },
  { title: '길을 찾는 책 도덕경', author: '노자, 켄 리우', cover_url: null, status: 'want_to_read', rating: 1, date_started: '2026-04-02', date_finished: '2026-04-11' },
  { title: '최진석의 대한민국 읽기', author: '최진석', cover_url: null, status: 'want_to_read', rating: 1, date_started: '2026-04-12', date_finished: '2026-04-21' },
  { title: '나는 어떻게 삶의 해답을 찾는가', author: '고명환', cover_url: null, status: 'reading', rating: null, date_started: '2026-04-23', date_finished: null },
  { title: '초보 아빠가 꼭 알아야 할 임신 출산 육아법', author: '최경일', cover_url: null, status: 'completed', rating: 2, date_started: '2026-05-23', date_finished: '2026-05-23' },
]

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Check if books already exist to avoid duplicates
  const { data: existing } = await supabase.from('books').select('title')
  const existingTitles = new Set((existing || []).map((b: { title: string }) => b.title))

  const toInsert = BOOKS.filter(b => !existingTitles.has(b.title))

  if (toInsert.length === 0) {
    return NextResponse.json({ message: '이미 모두 임포트되어 있습니다.', count: 0 })
  }

  const { error, count } = await supabase.from('books').insert(toInsert)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: `${toInsert.length}권 임포트 완료!`, count: toInsert.length })
}

export async function GET() {
  return NextResponse.json({ message: 'POST 요청으로 임포트하세요.' })
}
