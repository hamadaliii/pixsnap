'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { generateSlug } from '@/lib/utils'

export default function CreateEventPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const slug = generateSlug(name)

    const { data, error } = await supabase
      .from('events')
      .insert({
        name,
        description: description || null,
        date: date || null,
        slug,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Go directly to the admin page for this new event
      router.push(`/dashboard/admin/${data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Navbar />

      <main className="max-w-xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-neutral-400 mb-8">
          <Link href="/dashboard" className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
            Events
          </Link>
          <span>/</span>
          <span>New event</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 mb-8">
          Create event
        </h1>

        <form onSubmit={handleCreate} className="space-y-5">
          <Input
            label="Event name *"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sarah & James Wedding"
            required
          />

          <div className="w-full">
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — shown to guests on the event page"
              rows={3}
              className="input resize-none"
            />
          </div>

          <Input
            label="Event date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              Create event
            </Button>
            <Link href="/dashboard">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
