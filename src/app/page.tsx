"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Preloader from "@/components/Preloader";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import About from "@/components/About";
import Footer from "@/components/Footer";

export default function Home() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <main className="relative flex flex-col min-h-screen overflow-hidden bg-black">
      <Preloader />

      <AnimatePresence mode="wait">
        {!showDetails ? (
          <motion.div
            key="hero-view"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col flex-1 h-screen overflow-hidden"
          >
            <Hero />
            
            {/* Know More Button - Bottom Left */}
            <div className="absolute bottom-8 left-8 z-50 pointer-events-auto">
              <button
                onClick={() => setShowDetails(true)}
                className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 glass backdrop-blur-md hover:scale-105 active:scale-95 group"
              >
                <span>Know More</span>
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details-view"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-20 flex flex-col flex-1 h-screen overflow-y-auto bg-black"
          >
            {/* Go Back Button */}
            <div className="sticky top-0 z-50 p-6 bg-gradient-to-b from-black/90 via-black/60 to-transparent pointer-events-none">
              <button
                onClick={() => setShowDetails(false)}
                className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 glass backdrop-blur-md hover:scale-105 active:scale-95 pointer-events-auto group w-max"
              >
                <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Go Back</span>
              </button>
            </div>

            <div className="relative pb-10">
              <Features />
              <About />
              <Footer />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
