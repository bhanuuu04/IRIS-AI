"use client";

import { motion, Variants } from "framer-motion";
import { Activity, BrainCircuit, LineChart, ShieldCheck } from "lucide-react";

const features = [
  {
    title: "Real-Time Anomaly Detection",
    description: "Identify unusual trading patterns the millisecond they occur.",
    icon: Activity,
  },
  {
    title: "AI-Driven Insights",
    description: "Deep learning models trained on decades of market data.",
    icon: BrainCircuit,
  },
  {
    title: "Market Behavior Analysis",
    description: "Understand the 'why' behind the market movements instantly.",
    icon: LineChart,
  },
  {
    title: "Secure & Reliable",
    description: "Enterprise-grade security protecting your financial intel.",
    icon: ShieldCheck,
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function Features() {
  return (
    <section className="relative px-4 py-24 mx-auto max-w-7xl">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          Unprecedented Market Intelligence
        </h2>
        <p className="mt-4 text-white/50">
          Powered by state-of-the-art neural networks.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {features.map((feature, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="p-8 transition-all duration-300 rounded-2xl glass hover:bg-white/10 group"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-6 transition-transform duration-300 rounded-full bg-white/5 group-hover:scale-110">
              <feature.icon className="w-6 h-6 text-white/80 group-hover:text-white" />
            </div>
            <h3 className="mb-3 text-lg font-semibold text-white/90">
              {feature.title}
            </h3>
            <p className="text-sm leading-relaxed text-white/50">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
