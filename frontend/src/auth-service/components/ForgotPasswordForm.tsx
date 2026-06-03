import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'

const forgotSchema = z.object({
  email: z.string().email('Adresse email invalide.'),
})

type ForgotPasswordData = z.infer<typeof forgotSchema>

export type ForgotPasswordFormProps = {
  redirectTo?: string
}

export const ForgotPasswordForm = ({ redirectTo }: ForgotPasswordFormProps) => {
  const { resetPassword } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async ({ email }: ForgotPasswordData) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    const { error } = await resetPassword(email, redirectTo)
    if (error) {
      setErrorMessage(error)
      return
    }
    setSuccessMessage(
      'Email de réinitialisation envoyé. Consultez votre boîte de réception.',
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-md space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-busy={isSubmitting}
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">Mot de passe oublié</h2>
        <p className="text-sm text-slate-600">
          Recevez un lien sécurisé pour réinitialiser votre mot de passe.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="forgot-email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'forgot-email-error' : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p id="forgot-email-error" className="text-xs text-red-600">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          role="status"
          className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {successMessage}
        </p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
        disabled={isSubmitting}
        aria-disabled={isSubmitting}
      >
        {isSubmitting ? 'Envoi...' : 'Envoyer le lien'}
      </button>
    </form>
  )
}
