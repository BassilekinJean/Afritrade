import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
    confirmPassword: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })

type ResetPasswordData = z.infer<typeof resetSchema>

export const ResetPasswordForm = () => {
  const { updatePassword } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetSchema),
  })

  const onSubmit = async ({ password }: ResetPasswordData) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    const { error } = await updatePassword(password)
    if (error) {
      setErrorMessage(error)
      return
    }
    setSuccessMessage('Mot de passe mis à jour. Vous pouvez vous reconnecter.')
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-md space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-busy={isSubmitting}
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">
          Réinitialiser le mot de passe
        </h2>
        <p className="text-sm text-slate-600">
          Choisissez un nouveau mot de passe sécurisé.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="reset-password" className="text-sm font-medium text-slate-700">
            Nouveau mot de passe
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? (
            <p id="reset-password-error" className="text-xs text-red-600">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="reset-confirm-password"
            className="text-sm font-medium text-slate-700"
          >
            Confirmer le mot de passe
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? 'reset-confirm-password-error' : undefined
            }
            {...register('confirmPassword')}
          />
          {errors.confirmPassword ? (
            <p id="reset-confirm-password-error" className="text-xs text-red-600">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
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
        {isSubmitting ? 'Mise à jour...' : 'Mettre à jour'}
      </button>
    </form>
  )
}
