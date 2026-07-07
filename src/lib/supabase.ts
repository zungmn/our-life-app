import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Event = {
  id: string
  title: string
  date: string
  end_date?: string
  time?: string
  person: 'eddy' | 'judy' | 'both'
  note?: string
  file_url?: string
  photos?: string[]
  google_id?: string
  created_at: string
}

export type Transaction = {
  id: string
  date: string
  type: 'income' | 'expense'
  category: string
  subcategory?: string
  amount: number
  memo?: string
  payment_method?: string
  owner?: 'eddy' | 'judy'
  created_at: string
}

export type ClinicFinance = {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense'
  scope: 'hospital' | 'personal' | null
  category?: string
  name?: string
  is_saving: boolean
  created_at: string
}

export type WeddingGift = {
  id: string
  name: string
  amount: number
  date?: string
  method?: string
  thanked?: boolean
  repaid?: boolean
  note?: string
  created_at: string
}

export type Account = {
  id: string
  site: string
  category?: string
  username?: string
  password?: string
  extra_password?: string
  url?: string
  note?: string
  created_at: string
}

export type Book = {
  id: string
  title: string
  author?: string
  cover_url?: string
  status: 'want_to_read' | 'reading' | 'completed'
  rating?: number
  notes?: string
  date_started?: string
  date_finished?: string
  created_at: string
}

export type JournalEntry = {
  id: string
  date: string
  title?: string
  content: string
  mood?: string
  exercise?: string
  created_at: string
}

export type LifeNote = {
  id: string
  date: string
  title: string
  content: string
  type: 'record' | 'advice'
  source?: string
  created_at: string
}

export type Todo = {
  id: string
  title: string
  deadline?: string
  completed: boolean
  visibility: 'eddy' | 'both' | 'judy'
  owner: 'eddy' | 'judy'
  project_id?: string
  created_at: string
}

export type Project = {
  id: string
  title: string
  status: 'planned' | 'in_progress' | 'completed'
  visibility: 'eddy' | 'both' | 'judy'
  deadline?: string
  notes?: string
  file_url?: string
  created_at: string
}

export type ProjectMemo = {
  id: string
  project_id: string
  content: string
  author: 'eddy' | 'judy'
  created_at: string
}

export type ArchiveItem = {
  id: string
  title: string
  category?: string
  file_url?: string
  note?: string
  item_date?: string
  photos?: string[]
  purpose?: string
  distance?: number
  record_time?: string
  created_at: string
}

export type Birthday = {
  id: string
  name: string
  birthday: string
  relation?: string
  lunar_birthday?: string
  show_in_calendar?: boolean
  created_at: string
}

export type BirthdayGift = {
  id: string
  birthday_id: string
  year: number
  direction: 'received' | 'given'
  gift: string
  created_at: string
}
