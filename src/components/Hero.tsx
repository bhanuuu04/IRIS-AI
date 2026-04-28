"use client";

import { motion, AnimatePresence } from "framer-motion";
import Spline from '@splinetool/react-spline';
import { SignInButton, SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function Hero() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const isLoaded = authLoaded && userLoaded;

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setIsRedirecting(true);
      setTimeout(() => {
        // Redirect to natively hosted Next.js dashboard
        const dashboardUrl = '/dashboard';
        window.location.href = dashboardUrl;
      }, 3000); // 3 second transfer animation to let them read the message
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return <section className="min-h-screen bg-black" />;
  }

  let welcomeMessage = "AUTHENTICATED";
  let subMessage = "Establishing Secure Connection to IRIS Mainframe...";

  if (user) {
    // If account was created in the last 2 minutes, consider them a new user
    const createdAtTime = user.createdAt?.getTime() || 0;
    const isNew = Date.now() - createdAtTime < 120000;
    const name = user.firstName || user.username || "Agent";
    
    if (isNew) {
      welcomeMessage = "WELCOME TO IRIS";
      subMessage = `Initializing Secure Profile for ${name}...`;
    } else {
      welcomeMessage = "WELCOME BACK";
      subMessage = `Verifying Credentials for ${name}...`;
    }
  }

  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen px-4 py-32 text-center pointer-events-auto overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        {isRedirecting ? (
          <motion.div
            key="redirecting"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center w-full h-full bg-black/90 backdrop-blur-xl"
          >
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute w-24 h-24 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              <div className="absolute w-16 h-16 border-l-2 border-r-2 border-purple-500 rounded-full animate-[spin_1.5s_linear_reverse]"></div>
              <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse blur-sm"></div>
            </div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-3xl font-light tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 uppercase"
            >
              {welcomeMessage}
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="mt-4 text-xs tracking-widest text-blue-300/50 uppercase animate-pulse"
            >
              {subMessage}
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center w-full h-full"
          >
            {/* Background Layer 1: Huge Text (Behind Spline) */}
            <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
              <h1 className="text-[25vw] font-black tracking-tighter text-white/50 whitespace-nowrap select-none">
                IRIS AI
              </h1>
            </div>

            {/* Background Layer 2: Spline 3D Model */}
            <div className="absolute inset-0 z-10">
              <Spline scene="https://prod.spline.design/Q3GMtDpIP7QuGGjt/scene.splinecode" />
              {/* Watermark Cover */}
              <div className="absolute bottom-0 right-0 w-40 h-16 bg-black z-20 pointer-events-none"></div>
            </div>

            {/* Foreground Layer 3: Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="relative z-20 max-w-4xl mx-auto pointer-events-none mt-16"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="inline-flex items-center px-3 py-1 mb-6 text-xs font-medium border rounded-full text-white/70 border-white/10 glass bg-black/20 backdrop-blur-md pointer-events-auto"
              >
                <span className="w-2 h-2 mr-2 bg-blue-500 rounded-full animate-pulse"></span>
                System Online
              </motion.div>
              
              <p className="mb-4 text-2xl font-light text-white/90 md:text-3xl drop-shadow-lg pointer-events-auto">
                Detect Insider Risks Before the Market Reacts.
              </p>
              
              <p className="max-w-2xl mx-auto mb-10 text-base text-white/80 md:text-lg drop-shadow-lg bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10 pointer-events-auto">
                Advanced artificial intelligence monitoring global market behaviors to identify 
                and neutralize financial risks in real-time.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row pointer-events-auto">
                <SignInButton mode="modal">
                  <button className="relative px-8 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 group backdrop-blur-md">
                    <div className="absolute inset-0 transition-opacity duration-300 rounded-full opacity-50 blur-md bg-brand-primary group-hover:opacity-80"></div>
                    <span className="relative">Login to Dashboard</span>
                  </button>
                </SignInButton>
                
                <SignUpButton mode="modal">
                  <button className="px-8 py-3 text-sm font-semibold transition-all duration-300 rounded-full text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20 hover:scale-105 active:scale-95 backdrop-blur-md">
                    Register Account
                  </button>
                </SignUpButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
