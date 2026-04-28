"use client";

import { motion } from "framer-motion";

export default function About() {
  return (
    <section className="relative px-4 py-24 mx-auto max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl p-8 mx-auto text-center md:p-12 rounded-3xl glass"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 mb-8 border rounded-2xl bg-white/5 border-white/10">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        
        <h2 className="mb-6 text-3xl font-bold tracking-tight text-white md:text-4xl">
          About IRIS AI
        </h2>
        
        <p className="text-lg leading-relaxed text-white/70">
          IRIS AI (Insider Risk Identification System) is an advanced financial monitoring platform designed 
          to proactively identify potential risks before they manifest in the market. By leveraging 
          state-of-the-art machine learning models, IRIS provides enterprise-grade security and 
          intelligence, allowing institutions to monitor anomalies and secure their financial future 
          with absolute precision.
        </p>
      </motion.div>
    </section>
  );
}
