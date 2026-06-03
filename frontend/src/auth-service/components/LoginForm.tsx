import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
})

type LoginFormData = z.infer<typeof loginSchema>

const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 30_000

export type LoginFormProps = {
  onSuccess?: () => void
}

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const { signIn } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)

  useEffect(() => {
    if (lockoutRemaining <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      setLockoutRemaining((previous) => {
        const next = Math.max(0, previous - 1000)
        if (next === 0) {
          setFailedAttempts(0)
        }
        return next
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [lockoutRemaining])

  const isLocked = useMemo(() => lockoutRemaining > 0, [lockoutRemaining])
  const lockoutSeconds = Math.ceil(lockoutRemaining / 1000)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    if (isLocked) {
      return
    }
    setErrorMessage(null)
    const { error } = await signIn(data)
    if (error) {
      const nextAttempts = failedAttempts + 1
      setFailedAttempts(nextAttempts)
      setErrorMessage(error)
      if (nextAttempts >= MAX_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_MS)
      }
      return
    }
    setFailedAttempts(0)
    setLockoutRemaining(0)
    onSuccess?.()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-md space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-busy={isSubmitting}
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">Connexion</h2>
        <p className="text-sm text-slate-600">
          Accédez à votre espace sécurisé en toute simplicité.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <p id="login-email-error" className="text-xs text-red-600">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="login-password"
            className="text-sm font-medium text-slate-700"
          >
            Mot de passe
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? (
            <p id="login-password-error" className="text-xs text-red-600">
              {errors.password.message}
            </p>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isLocked ? (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700"
        >
          Trop de tentatives. Réessayez dans {lockoutSeconds} seconde
          {lockoutSeconds > 1 ? 's' : ''}.
        </p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
        disabled={isSubmitting || isLocked}
        aria-disabled={isSubmitting || isLocked}
      >
        {isSubmitting ? 'Connexion...' : 'Se connecter'}
      </button>
    </form>
  )
}
