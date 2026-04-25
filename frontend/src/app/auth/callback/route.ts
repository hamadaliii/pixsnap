import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * This route handles the redirect after a user clicks the email
 * confirmation link. Supabase sends the user here with a code.
 * We exchange that code for a session, then redirect to dashboard.
 *
 * The URL looks like:
 *   /auth/callback?code=abc123
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successfully confirmed email — send to dashboard
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Something went wrong — send back to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=Could not confirm email`)
}
