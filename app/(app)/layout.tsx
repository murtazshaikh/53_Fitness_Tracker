import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <ul className="mx-auto flex max-w-2xl gap-5 px-4 py-3 text-sm">
          <li><Link href="/workout" className="hover:underline">Workout</Link></li>
          <li><Link href="/history" className="hover:underline">History</Link></li>
          <li><Link href="/exercises" className="hover:underline">Exercises</Link></li>
        </ul>
      </nav>
      {children}
    </div>
  )
}
