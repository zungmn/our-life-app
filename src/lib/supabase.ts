import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Event = {
  id: string
  title: string
  date: string
  time?: string
  person: 'eddy' | 'judy' | 'both'
  note?: string
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
  content: string
  mood?: string
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
  visibility: 'eddy' | 'both'
  created_at: string
}

export type Project = {
  id: string
  title: string
  status: 'in_progress' | 'completed'
  visibility: 'eddy' | 'both'
  created_at: string
}
