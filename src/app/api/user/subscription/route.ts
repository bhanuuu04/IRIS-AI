import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ active: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('users')
      .select('pro_mode_active, subscription_expires_at')
      .eq('clerk_id', userId)
      .single()

    if (error) {
      console.error("Supabase Error:", error)
      // If user not found, they definitely aren't pro yet
      return NextResponse.json({ active: false })
    }

    let active = data.pro_mode_active

    // Check expiration if it's set
    if (active && data.subscription_expires_at) {
      const expiresAt = new Date(data.subscription_expires_at)
      if (expiresAt < new Date()) {
        active = false
      }
    }

    return NextResponse.json({ active })
  } catch (err) {
    console.error("Subscription check error:", err)
    return NextResponse.json({ active: false, error: "Internal Server Error" }, { status: 500 })
  }
}
