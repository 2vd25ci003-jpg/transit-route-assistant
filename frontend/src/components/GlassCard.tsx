"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  enableTilt?: boolean;
}

export function GlassCard({
  children,
  className = "",
  enableTilt = true,
}: GlassCardProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      whileHover={
        enableTilt && !prefersReduced
          ? {
              y: -2,
              rotateX: 1.5,
              rotateY: -1.5,
              transition: { duration: 0.18 },
            }
          : undefined
      }
      style={{ transformStyle: "preserve-3d" }}
      className={`bg-surface-container/75 backdrop-blur-xl border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.42)] rounded-2xl ${className}`}
    >
      {children}
    </motion.div>
  );
}
