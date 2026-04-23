import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge Tailwind classes safely (avoids conflicts)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a short random slug for events (e.g. "wedding-abc12")
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

// Format a date string nicely
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date set'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Build the public event URL from a slug
export function getEventUrl(slug: string): string {
  const base = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${base}/event/${slug}`
}
