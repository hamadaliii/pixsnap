export interface Event {
  id: string
  name: string
  description: string | null
  date: string | null
  slug: string
  created_by: string
  created_at: string
  pin_code: string | null
  expires_at: string | null
  is_active: boolean
  price_per_photo_ore: number
  package_enabled: boolean
  package_price_ore: number
  photographer_logo_url: string | null
  photographer_name: string | null
  watermark_text: string | null
  published_at: string | null
  notification_sent: boolean
}

export interface Photo {
  id: string
  event_id: string
  storage_path: string
  public_url: string
  watermark_url: string | null
  processed: boolean
  created_at: string
}

export interface GuestSession {
  id: string
  event_id: string
  email: string | null
  photo_ids: string[]
  token: string
  created_at: string
}

export interface Purchase {
  id: string
  guest_session_id: string | null
  photo_ids: string[]
  stripe_session_id: string
  amount_ore: number
  status: 'pending' | 'paid' | 'failed'
  created_at: string
}