import { createContext, type ReactNode } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import type { AuthLogger } from '../hooks/useLogger'

export type AuthCredentials = {
  email: string
  password: string
}

export type SignUpParams = AuthCredentials & {
  emailRedirectTo?: string
}

export type AuthActionResult = {
  error: string | null
}

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (credentials: AuthCredentials) => Promise<AuthActionResult>
  signUp: (params: SignUpParams) => Promise<AuthActionResult>
  signOut: () => Promise<AuthActionResult>
  resetPassword: (email: string, redirectTo?: string) => Promise<AuthActionResult>
  updatePassword: (password: string) => Promise<AuthActionResult>
}

export type AuthProviderProps = {
  children: ReactNode
  supabaseClient?: SupabaseClient
  logger?: AuthLogger
  emailRedirectTo?: string
  passwordResetRedirectTo?: string
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
