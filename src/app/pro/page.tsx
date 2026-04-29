"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Check, Sparkles, ShieldAlert, BrainCircuit,
  Zap, BarChart3, Loader2, Tag, CheckCircle2, X
} from 'lucide-react';
import Script from 'next/script';

export default function ProSubscriptionPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [couponMessage, setCouponMessage] = useState('');
  const [pageExit, setPageExit] = useState(false);

  // New states for CUxGT flow
  const [price, setPrice] = useState(149);
  const [showSubmit, setShowSubmit] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState('');

  const handleSubscribe = async () => {
    try {
      setIsProcessing(true);

      // 1. Create Order
      const res = await fetch('/api/razorpay/order', { method: 'POST' });
      const data = await res.json();

      if (!data.order) throw new Error('Failed to create order');

      // 2. Initialize Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'IRIS AI',
        description: 'Pro Mode Monthly Subscription',
        order_id: data.order.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              triggerSuccessExit();
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (err) {
            console.error(err);
            alert('Error verifying payment.');
          }
        },
        theme: { color: '#9333ea' },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (error) {
      console.error(error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyCoupon = async () => {
    const trimmed = couponCode.trim();
    if (!trimmed) return;

    setCouponStatus('loading');
    setCouponMessage('');

    try {
      const res = await fetch('/api/coupon/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: trimmed }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCouponStatus('success');
        setCouponMessage('Coupon applied!');
        setAppliedCoupon(data.couponCode);

        // Price drop animation
        animate(149, 0, {
          duration: 1,
          ease: "circOut",
          onUpdate: (latest) => setPrice(Math.round(latest))
        });
        
        setShowSubmit(true);
      } else {
        setCouponStatus('error');
        setCouponMessage(data.error || 'Invalid coupon code. Please try again.');
        setTimeout(() => setCouponStatus('idle'), 3000);
      }
    } catch (err) {
      console.error(err);
      setCouponStatus('error');
      setCouponMessage('Something went wrong. Please try again.');
      setTimeout(() => setCouponStatus('idle'), 3000);
    }
  };

  const handleSubmitCoupon = async () => {
    try {
      const res = await fetch('/api/coupon/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: appliedCoupon }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error('[activate] Failed:', data.error);
      }
    } catch (err) {
      console.error('[activate] Network error:', err);
    }
    // Regardless of edge errors, show welcome and redirect
    triggerSuccessExit();
  };

  const triggerSuccessExit = () => {
    setPageExit(true);
    setTimeout(() => router.push('/dashboard'), 2000);
  };

  const features = [
    { icon: <ShieldAlert className="w-5 h-5 text-purple-400" />, text: 'Identifies unusual trading behavior early' },
    { icon: <BrainCircuit className="w-5 h-5 text-purple-400" />, text: 'Uses advanced AI for deeper pattern recognition' },
    { icon: <Zap className="w-5 h-5 text-purple-400" />, text: 'Provides faster and more accurate alerts' },
    { icon: <BarChart3 className="w-5 h-5 text-purple-400" />, text: 'Designed for serious investors, analysts, and institutions' },
  ];

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <motion.div
        className="min-h-screen bg-[#06080c] text-white selection:bg-purple-500/30 font-sans relative overflow-hidden"
        animate={pageExit ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Background Ambient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Navigation */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative z-10 w-full px-8 py-6 flex items-center justify-between"
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </button>
          <div className="text-xl font-bold tracking-wider">
            IRIS <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">PRO</span>
          </div>
        </motion.nav>

        {/* Main Content */}
        <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-24 grid lg:grid-cols-2 gap-16 items-center">

          {/* Left Column - Copy */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Advanced Intelligence Layer
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 tracking-tight">
              Unlock the ultimate <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-600">
                market advantage
              </span>
            </h1>

            <p className="text-lg text-gray-400 mb-10 leading-relaxed max-w-lg">
              IRIS Pro Mode is the advanced intelligence layer of your IRIS AI system. It uses deeper analysis and smarter models to detect hidden insider risks and suspicious patterns in stock market activity.
            </p>

            <div className="space-y-4 mb-10">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-4 text-gray-300 bg-white/5 border border-white/5 rounded-xl p-4 backdrop-blur-sm"
                >
                  <div className="flex-shrink-0 bg-purple-500/10 p-2 rounded-lg">
                    {feature.icon}
                  </div>
                  <span className="font-medium text-sm md:text-base">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Pricing Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="relative"
          >
            {/* Card Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 to-transparent blur-2xl rounded-3xl transform -translate-y-4 pointer-events-none" />

            <div className="relative bg-[#0d1117]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Pro Subscription</h2>
                <p className="text-gray-400 text-sm">Monthly access to the Reasoning Engine</p>
              </div>

              <div className="flex justify-center items-baseline gap-2 mb-8">
                <span className="text-5xl font-bold text-white">₹{price}</span>
                <span className="text-gray-400 font-medium">/ month</span>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  <span>Unlimited Deep Scans</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  <span>Real-time anomalous pattern detection</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  <span>Multi-timeframe convergence analysis</span>
                </div>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={isProcessing}
                className="flex items-center justify-center w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Subscribe with Razorpay'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-500 font-medium tracking-wider uppercase">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* ── Coupon Code Section ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Tag className="w-4 h-4 text-purple-400" />
                  <span>Have a coupon code?</span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="coupon-input"
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        if (couponStatus !== 'idle') setCouponStatus('idle');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      placeholder="ENTER CODE"
                      maxLength={20}
                      className={`
                        w-full px-4 py-3 rounded-xl text-sm font-mono font-semibold tracking-widest
                        bg-white/5 border transition-all outline-none placeholder:text-gray-600
                        ${couponStatus === 'success'
                          ? 'border-green-500/60 text-green-400 bg-green-500/5'
                          : couponStatus === 'error'
                          ? 'border-red-500/60 text-red-400 bg-red-500/5'
                          : 'border-white/10 text-white focus:border-purple-500/60 focus:bg-purple-500/5'
                        }
                      `}
                      disabled={couponStatus === 'loading' || couponStatus === 'success'}
                    />
                    {/* Status icon inside input */}
                    <AnimatePresence>
                      {(couponStatus === 'success' || couponStatus === 'error') && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {couponStatus === 'success'
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <X className="w-4 h-4 text-red-400" />
                          }
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponStatus === 'loading' || couponStatus === 'success' || !couponCode.trim()}
                    className="px-5 py-3 rounded-xl text-sm font-bold bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 hover:border-purple-500/50 hover:text-purple-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {couponStatus === 'loading'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : 'Apply'
                    }
                  </button>

                  <AnimatePresence>
                    {showSubmit && (
                      <motion.button
                        initial={{ opacity: 0, width: 0, padding: 0 }}
                        animate={{ opacity: 1, width: 'auto', padding: '0.75rem 1.25rem' }}
                        exit={{ opacity: 0, width: 0, padding: 0 }}
                        onClick={handleSubmitCoupon}
                        className="rounded-xl text-sm font-bold bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 hover:border-green-500/50 hover:text-green-300 transition-all whitespace-nowrap overflow-hidden"
                      >
                        Submit
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Feedback message */}
                <AnimatePresence>
                  {couponMessage && (
                    <motion.p
                      key={couponMessage}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className={`text-xs font-medium flex items-center gap-1.5 ${
                        couponStatus === 'success' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {couponStatus === 'success'
                        ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        : <X className="w-3.5 h-3.5 flex-shrink-0" />
                      }
                      {couponMessage}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-center text-xs text-gray-500 mt-6">
                Secure payment processed via Razorpay. Cancel anytime.
              </p>
            </div>
          </motion.div>

        </main>

        {/* ── Cinematic Welcome Overlay ── */}
        <AnimatePresence>
          {pageExit && (
            <motion.div
              className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a0533 0%, #06080c 70%)' }}
            >
              {/* Ambient glow blobs */}
              <motion.div
                className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.2, ease: 'easeOut' }}
              />

              {/* Horizontal shimmer line */}
              <motion.div
                className="absolute w-full h-px pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.5), rgba(99,102,241,0.5), transparent)', top: '48%' }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 1.0, delay: 0.3, ease: 'easeInOut' }}
              />

              {/* Content stack */}
              <div className="relative z-10 flex flex-col items-center text-center px-6 gap-6 max-w-3xl">

                {/* Offer pill — CUxGT only */}
                {appliedCoupon === 'CUXGT' && (
                  <motion.div
                    initial={{ y: -30, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, type: 'spring', stiffness: 200, damping: 18 }}
                    className="relative"
                  >
                    {/* Pill glow */}
                    <div className="absolute inset-0 rounded-full blur-lg opacity-40" style={{ background: 'linear-gradient(90deg, #a855f7, #6366f1)' }} />
                    <div className="relative flex items-center gap-2.5 px-6 py-3 rounded-full border border-purple-400/30"
                      style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(99,102,241,0.15))' }}>
                      {/* Pulsing dot */}
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-300" />
                      </span>
                      <p className="text-sm md:text-base font-bold tracking-widest uppercase"
                        style={{ background: 'linear-gradient(90deg, #d8b4fe, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Offer Active&nbsp;·&nbsp;Chandigarh University&nbsp;×&nbsp;Grant Thornton
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Icon ring */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.5, type: 'spring', stiffness: 240, damping: 16 }}
                  className="relative flex items-center justify-center"
                >
                  {/* Outer pulse ring */}
                  <motion.div
                    className="absolute rounded-full border border-purple-500/30"
                    animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    style={{ width: 100, height: 100 }}
                  />
                  <motion.div
                    className="absolute rounded-full border border-purple-400/20"
                    animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4, ease: 'easeOut' }}
                    style={{ width: 100, height: 100 }}
                  />
                  <div className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.15))', border: '1px solid rgba(168,85,247,0.4)', boxShadow: '0 0 40px rgba(168,85,247,0.3)' }}>
                    <CheckCircle2 className="w-11 h-11 text-purple-300" />
                  </div>
                </motion.div>

                {/* Headline */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.65, ease: [0.23, 1, 0.32, 1] }}
                  className="flex flex-col items-center gap-3"
                >
                  <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight"
                    style={{ background: 'linear-gradient(135deg, #ffffff 0%, #d8b4fe 50%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {appliedCoupon === 'CUXGT' ? 'Welcome to Pro Mode' : 'Pro Activated!'}
                  </h1>
                  {appliedCoupon === 'CUXGT' && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.85 }}
                      className="text-2xl md:text-3xl font-bold"
                      style={{ background: 'linear-gradient(90deg, #a855f7, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      of IRIS AI
                    </motion.p>
                  )}
                </motion.div>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  className="text-gray-400 text-base md:text-lg"
                >
                  Taking you to your dashboard…
                </motion.p>

                {/* Bottom shimmer bar */}
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '180px', opacity: 1 }}
                  transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
                  className="h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, #a855f7, #6366f1, transparent)' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
