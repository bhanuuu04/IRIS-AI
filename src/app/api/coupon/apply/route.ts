import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const VALID_COUPONS = ['TEAMNOMI', 'CUXGT'];

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { couponCode } = await req.json();
    const upperCode = couponCode?.trim().toUpperCase();

    if (!upperCode || !VALID_COUPONS.includes(upperCode)) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    // ✅ Validation only — no DB write yet. DB update happens on Submit (/api/coupon/activate)
    return NextResponse.json({ success: true, couponCode: upperCode });
  } catch (err: any) {
    console.error('[coupon/apply] Unexpected error:', err);
    return NextResponse.json({ error: 'Error: ' + (err.message || 'Unknown exception') }, { status: 500 });
  }
}

