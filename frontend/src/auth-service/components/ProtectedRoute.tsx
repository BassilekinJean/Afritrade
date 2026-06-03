import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export type ProtectedRouteProps = {
  children: ReactNode
  redirectTo?: string
  fallback?: ReactNode
}

export const ProtectedRoute = ({
  children,
  redirectTo = '/login',
  fallback = null,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <>{fallback}</>
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  return <>{children}</>
}
