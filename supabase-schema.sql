-- 캘린더 이벤트
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  person TEXT NOT NULL CHECK (person IN ('eddy', 'judy', 'both')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 수입/지출 내역
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 독서 기록
CREATE TABLE books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'reading' CHECK (status IN ('want_to_read', 'reading', 'completed')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  date_started DATE,
  date_finished DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 감사 일기
CREATE TABLE journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인생 기록 & 조언
CREATE TABLE life_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('record', 'advice')),
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 모든 테이블 공개 접근 허용 (로그인 없이 사용)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON life_notes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 치과 가계부 (clinic finance) — Notion 가져오기
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_finance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  scope TEXT CHECK (scope IN ('hospital', 'personal')),  -- 병원 경비 / 생활비
  category TEXT,                                          -- 분류 (기공료, 재료비, 직원, 마케팅 ...)
  name TEXT,                                              -- 항목명 / 메모
  is_saving BOOLEAN DEFAULT FALSE,                        -- 저축 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_finance_date ON clinic_finance(date);
CREATE INDEX IF NOT EXISTS idx_clinic_finance_scope ON clinic_finance(scope);

ALTER TABLE clinic_finance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON clinic_finance FOR ALL USING (true) WITH CHECK (true);

-- 일정에 사진 여러 장 첨부
ALTER TABLE events ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}';

-- 계정 관리
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site TEXT NOT NULL,
  category TEXT,
  username TEXT,
  password TEXT,
  extra_password TEXT,
  url TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON accounts FOR ALL USING (true) WITH CHECK (true);

-- 축의금 받은 목록 (청첩장 상환 참고용)
CREATE TABLE IF NOT EXISTS wedding_gifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount BIGINT DEFAULT 0,
  date DATE,
  method TEXT,
  thanked BOOLEAN DEFAULT FALSE,
  repaid BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE wedding_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON wedding_gifts FOR ALL USING (true) WITH CHECK (true);

-- 자료실 확장 (여러 장 사진, 용도, 마라톤 거리/기록)
ALTER TABLE archive_items ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}';
ALTER TABLE archive_items ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE archive_items ADD COLUMN IF NOT EXISTS distance numeric;
ALTER TABLE archive_items ADD COLUMN IF NOT EXISTS record_time text;

-- 기존 분류 → 새 5개 분류 자동 이동
UPDATE archive_items SET category = '사진기록' WHERE category IN ('사진', '건강', '재정', '기타') OR category IS NULL;
UPDATE archive_items SET category = '치과 면허증' WHERE category = '기록증/수료증';

-- ===== 앱 공용 상태 저장 (기기 간 공유) =====
-- 잔금 현황 등 localStorage 대신 서버에 저장하여 PC/모바일 동기화
CREATE TABLE IF NOT EXISTS app_state (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_state all" ON app_state;
CREATE POLICY "app_state all" ON app_state FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE app_state TO anon, authenticated;

-- ===== 잔금 현황 변경 이력 (감사 로그 + 되돌리기) =====
CREATE TABLE IF NOT EXISTS balance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL,
  label text,
  delta numeric,
  before_val numeric,
  after_val numeric,
  unit text,
  viewer text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE balance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "balance_logs all" ON balance_logs;
CREATE POLICY "balance_logs all" ON balance_logs FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE balance_logs TO anon, authenticated;

-- ===== 구글 캘린더 양방향 동기화 =====
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_id text;
CREATE INDEX IF NOT EXISTS events_google_id_idx ON events(google_id);
-- 토큰은 app_state('google_auth')에 저장됨 (app_state 테이블 필요)
