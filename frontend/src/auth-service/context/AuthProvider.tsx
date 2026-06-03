import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../config/supabaseClient'
import { useLogger } from '../hooks/useLogger'
import {
  AuthContext,
  type AuthActionResult,
  type AuthCredentials,
  type AuthProviderProps,
  type AuthContextValue,
  type SignUpParams,
} from './AuthContext'

export const AuthProvider = ({
  children,
  supabaseClient,
  logger,
  emailRedirectTo,
  passwordResetRedirectTo,
}: AuthProviderProps) => {
  const supabase = useMemo<SupabaseClient>(
    () => supabaseClient ?? getSupabaseClient(),
    [supabaseClient],
  )
  const { log } = useLogger(logger)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      setLoading(true)
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) {
        return
      }
      if (error) {
        log({ type: 'SESSION_ERROR', error: error.message })
      }
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    loadSession()

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return
      }
      setSession(nextSession ?? null)
      setUser(nextSession?.user ?? null)
      setLoading(false)
      log({
        type: 'AUTH_STATE_CHANGE',
        message: event,
        meta: { event, userId: nextSession?.user?.id },
      })
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [log, supabase])

  const signIn = useCallback(
    async ({ email, password }: AuthCredentials): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        log({ type: 'SIGN_IN_FAILURE', error: error.message })
        return { error: error.message }
      }

      log({
        type: 'SIGN_IN_SUCCESS',
        message: 'User signed in.',
        meta: { userId: data.user?.id },
      })
      return { error: null }
    },
    [log, supabase],
  )

  const signUp = useCallback(
    async ({
      email,
      password,
      emailRedirectTo: redirectOverride,
    }: SignUpParams): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectOverride ?? emailRedirectTo,
        },
      })

      if (error) {
        log({ type: 'SIGN_UP_FAILURE', error: error.message })
        return { error: error.message }
      }

      log({
        type: 'SIGN_UP_SUCCESS',
        message: 'User registered.',
        meta: { userId: data.user?.id },
      })
      return { error: null }
    },
    [emailRedirectTo, log, supabase],
  )

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      log({ type: 'SIGN_OUT_FAILURE', error: error.message })
      return { error: error.message }
    }
    log({ type: 'SIGN_OUT_SUCCESS', message: 'User signed out.' })
    return { error: null }
  }, [log, supabase])

  const resetPassword = useCallback(
    async (email: string, redirectTo?: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo ?? passwordResetRedirectTo,
      })

      if (error) {
        log({ type: 'RESET_PASSWORD_FAILURE', error: error.message })
        return { error: error.message }
      }

      log({
        type: 'RESET_PASSWORD_EMAIL_SENT',
        message: 'Password reset email sent.',
        meta: { email },
      })
      return { error: null }
    },
    [log, passwordResetRedirectTo, supabase],
  )

  const updatePassword = useCallback(
    async (password: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        log({ type: 'UPDATE_PASSWORD_FAILURE', error: error.message })
        return { error: error.message }
      }
      log({ type: 'UPDATE_PASSWORD_SUCCESS', message: 'Password updated.' })
      return { error: null }
    },
    [log, supabase],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [loading, resetPassword, session, signIn, signOut, signUp, updatePassword, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
