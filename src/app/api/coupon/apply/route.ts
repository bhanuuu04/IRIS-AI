import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Must use Service Role Key to bypass RLS for writes
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const VALID_COUPON = 'TEAMNOMI';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { couponCode } = await req.json();

    if (!couponCode || couponCode.trim().toUpperCase() !== VALID_COUPON) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    // Grant 1 day of pro access from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    // Use upsert so it works whether or not the user row exists yet
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          clerk_id: userId,
          pro_mode_active: true,
          subscription_expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'clerk_id' }
      );

    if (upsertError) {
      console.error('[coupon/apply] Supabase upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to apply coupon. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error('[coupon/apply] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
