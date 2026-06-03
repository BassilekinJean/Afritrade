import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type SupabaseConfig = {
  supabaseUrl?: string
  supabaseAnonKey?: string
}

const defaultUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const defaultAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const createSupabaseClient = ({
  supabaseUrl = defaultUrl,
  supabaseAnonKey = defaultAnonKey,
}: SupabaseConfig = {}): SupabaseClient => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

let cachedClient: SupabaseClient | null = null

export const getSupabaseClient = (): SupabaseClient => {
  if (!cachedClient) {
    cachedClient = createSupabaseClient()
  }
  return cachedClient
}
