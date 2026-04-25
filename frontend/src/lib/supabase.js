import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google' })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()
