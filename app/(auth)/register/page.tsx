'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(formData: FormData) {
    setError(null)
    setBusy(true)
    const email = String(formData.get('email'))
    const password = String(formData.get('password'))

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: String(formData.get('name')) }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not create the account')
      setBusy(false)
      return
    }

    await signIn('credentials', { email, password, redirect: false })
    router.push('/workout')
  }

  return (
    <form action={submit} className="mx-auto mt-16 max-w-sm space-y-3 p-4">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <input name="name" required aria-label="Name" placeholder="Name"
             className="w-full rounded border border-neutral-300 px-3 py-2" />
      <input name="email" type="email" required aria-label="Email" placeholder="Email"
             className="w-full rounded border border-neutral-300 px-3 py-2" />
      <input name="password" type="password" required minLength={8} aria-label="Password"
             placeholder="Password (min 8 characters)"
             className="w-full rounded border border-neutral-300 px-3 py-2" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy}
              className="w-full rounded bg-blue-600 py-2 font-medium text-white disabled:opacity-50">
        {busy ? 'Creating…' : 'Register'}
      </button>
      <p className="text-sm text-neutral-600">
        Have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </form>
  )
}
