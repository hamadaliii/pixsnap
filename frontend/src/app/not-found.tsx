import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-mono text-neutral-400 mb-4">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
        Page not found
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/">
        <Button variant="secondary">Go home</Button>
      </Link>
    </div>
  )
}
