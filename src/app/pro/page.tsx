"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, ShieldAlert, BrainCircuit, Zap, BarChart3, Loader2 } from 'lucide-react';
import Script from 'next/script';

export default function ProSubscriptionPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    try {
      setIsProcessing(true);
      
      // 1. Create Order
      const res = await fetch('/api/razorpay/order', { method: 'POST' });
      const data = await res.json();
      
      if (!data.order) {
        throw new Error("Failed to create order");
      }

      // 2. Initialize Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Ensure you expose the ID to frontend
        amount: data.order.amount,
        currency: data.order.currency,
        name: "IRIS AI",
        description: "Pro Mode Monthly Subscription",
        order_id: data.order.id,
        handler: async function (response: any) {
          try {
            // 3. Verify Payment Signature Backend
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
            });

            const verifyData = await verifyRes.json();
            
            if (verifyData.success) {
              // 4. Redirect on Success
              router.push('/dashboard?payment_success=true');
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          } catch (err) {
            console.error(err);
            alert("Error verifying payment.");
          }
        },
        theme: {
          color: "#9333ea"
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const features = [
    { icon: <ShieldAlert className="w-5 h-5 text-purple-400" />, text: "Identifies unusual trading behavior early" },
    { icon: <BrainCircuit className="w-5 h-5 text-purple-400" />, text: "Uses advanced AI for deeper pattern recognition" },
    { icon: <Zap className="w-5 h-5 text-purple-400" />, text: "Provides faster and more accurate alerts" },
    { icon: <BarChart3 className="w-5 h-5 text-purple-400" />, text: "Designed for serious investors, analysts, and institutions" },
  ];

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="min-h-screen bg-[#06080c] text-white selection:bg-purple-500/30 font-sans relative overflow-hidden">
        
        {/* Background Ambient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Navigation */}
        <motion.nav 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
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
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
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
                  transition={{ duration: 0.5, delay: 0.4 + (i * 0.1) }}
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
                <span className="text-5xl font-bold text-white">₹149</span>
                <span className="text-gray-400 font-medium">/ month</span>
              </div>

              <div className="space-y-3 mb-10">
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
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Subscribe with Razorpay"}
              </button>
              
              <p className="text-center text-xs text-gray-500 mt-4">
                Secure payment processed via Razorpay. Cancel anytime.
              </p>
            </div>
          </motion.div>

        </main>
      </div>
    </>
  );
}
