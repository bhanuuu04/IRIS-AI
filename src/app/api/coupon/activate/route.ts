import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { VALID_COUPONS } from '../apply/route';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { couponCode } = await req.json();
    const upperCode = couponCode?.trim().toUpperCase();

    // Re-validate the coupon server-side (never trust client alone)
    if (!upperCode || !VALID_COUPONS.includes(upperCode)) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    // Grant 30 days of pro access
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Write to Supabase — this is the actual activation
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
      console.error('[coupon/activate] Supabase upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to activate subscription. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    console.error('[coupon/activate] Unexpected error:', err);
    return NextResponse.json({ error: 'Error: ' + (err.message || 'Unknown exception') }, { status: 500 });
  }
}
