export const EXPENSE_CATEGORIES = [
  { value: '직원', label: '직원', group: '병원 경비', color: '#3B82F6' },
  { value: '임대료', label: '임대료', group: '병원 경비', color: '#8B5CF6' },
  { value: '기공료', label: '기공료', group: '병원 경비', color: '#F59E0B' },
  { value: '재료비', label: '재료비', group: '병원 경비', color: '#10B981' },
  { value: '관리비', label: '관리비', group: '병원 경비', color: '#06B6D4' },
  { value: '마케팅', label: '마케팅', group: '병원 경비', color: '#F97316' },
  { value: '노무, 세무', label: '노무/세무', group: '병원 경비', color: '#84CC16' },
  { value: '대출 이자', label: '대출 이자', group: '병원 경비', color: '#EF4444' },
  { value: '임플란트 할부', label: '임플란트 할부', group: '병원 경비', color: '#EC4899' },
  { value: '세미나', label: '세미나', group: '병원 경비', color: '#14B8A6' },
  { value: '인터넷 요금', label: '인터넷 요금', group: '병원 경비', color: '#6366F1' },
  { value: '치과 보험', label: '치과 보험', group: '병원 경비', color: '#D946EF' },
  { value: '경조사비', label: '경조사비', group: '병원 경비', color: '#F43F5E' },
  { value: '병원 지출 카드', label: '병원 지출 카드', group: '병원 경비', color: '#0EA5E9' },
  { value: '기타', label: '기타', group: '병원 경비', color: '#9CA3AF' },
  { value: '생활비 카드', label: '생활비 카드', group: '생활비', color: '#A78BFA' },
  { value: '개인 사용', label: '개인 사용', group: '생활비', color: '#34D399' },
  { value: '개인 보험', label: '개인 보험', group: '생활비', color: '#FCD34D' },
]

export const INCOME_CATEGORIES = [
  { value: '진료 수입', label: '진료 수입', color: '#10B981' },
  { value: '임플란트', label: '임플란트', color: '#3B82F6' },
  { value: '기타 수입', label: '기타 수입', color: '#6B7280' },
]

export const PAYMENT_METHODS = [
  { value: '노출 현금', label: '노출 현금' },
  { value: '비노출 현금', label: '비노출 현금' },
  { value: '금고', label: '금고' },
  { value: '상품권', label: '상품권' },
  { value: '제약', label: '제약' },
  { value: '카드', label: '카드' },
  { value: '계좌이체', label: '계좌이체' },
]

export const BOOK_STATUS = {
  want_to_read: { label: '읽고 싶은', color: '#6B7280' },
  reading: { label: '읽는 중', color: '#3B82F6' },
  completed: { label: '완독', color: '#10B981' },
}

export const MOODS = [
  { value: 'great', label: '😄 최고' },
  { value: 'good', label: '😊 좋음' },
  { value: 'okay', label: '😐 보통' },
  { value: 'bad', label: '😔 별로' },
]

export const PERSON_COLORS = {
  eddy: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: '#3B82F6', label: 'Eddy' },
  judy: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', dot: '#EC4899', label: 'Judy' },
  both: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: '#8B5CF6', label: '함께' },
}
