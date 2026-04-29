import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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

    // Upsert so it works even if user row doesn't exist yet
    const { error } = await supabase
      .from('users')
      .update({
        pro_mode_active: true,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('clerk_id', userId);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: 'Failed to apply coupon' }, { status: 500 });
    }

    return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error('Coupon apply error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
