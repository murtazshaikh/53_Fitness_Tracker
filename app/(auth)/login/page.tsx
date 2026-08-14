'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(formData: FormData) {
    setError(null)
    setBusy(true)
    const res = await signIn('credentials', {
      email: String(formData.get('email')),
      password: String(formData.get('password')),
      redirect: false,
    })
    if (res?.error) {
      setError('Wrong email or password')
      setBusy(false)
    } else {
      router.push('/workout')
    }
  }

  return (
    <form action={submit} className="mx-auto mt-16 max-w-sm space-y-3 p-4">
      <h1 className="text-xl font-semibold">Log in</h1>
      <input name="email" type="email" required aria-label="Email" placeholder="Email"
             className="w-full rounded border border-neutral-300 px-3 py-2" />
      <input name="password" type="password" required aria-label="Password" placeholder="Password"
             className="w-full rounded border border-neutral-300 px-3 py-2" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy}
              className="w-full rounded bg-blue-600 py-2 font-medium text-white disabled:opacity-50">
        {busy ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-sm text-neutral-600">
        No account? <Link href="/register" className="underline">Register</Link>
      </p>
    </form>
  )
}
