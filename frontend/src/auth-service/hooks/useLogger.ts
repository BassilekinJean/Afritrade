import { useCallback } from 'react'

export type AuthLogEvent = {
  type:
    | 'AUTH_STATE_CHANGE'
    | 'SIGN_IN_SUCCESS'
    | 'SIGN_IN_FAILURE'
    | 'SIGN_UP_SUCCESS'
    | 'SIGN_UP_FAILURE'
    | 'SIGN_OUT_SUCCESS'
    | 'SIGN_OUT_FAILURE'
    | 'RESET_PASSWORD_EMAIL_SENT'
    | 'RESET_PASSWORD_FAILURE'
    | 'UPDATE_PASSWORD_SUCCESS'
    | 'UPDATE_PASSWORD_FAILURE'
    | 'SESSION_ERROR'
  message?: string
  error?: string
  meta?: Record<string, unknown>
}

export type AuthLogger = (event: AuthLogEvent) => void

const defaultLogger: AuthLogger = (event) => {
  const payload = {
    message: event.message,
    error: event.error,
    ...event.meta,
  }

  if (event.error) {
    console.error(`[auth] ${event.type}`, payload)
    return
  }

  console.info(`[auth] ${event.type}`, payload)
}

export const useLogger = (logger?: AuthLogger) => {
  const log = useCallback(
    (event: AuthLogEvent) => {
      const activeLogger = logger ?? defaultLogger
      activeLogger(event)
    },
    [logger],
  )

  return { log }
}
