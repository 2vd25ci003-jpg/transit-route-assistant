"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface DraggableSheetProps {
  children: React.ReactNode;
  title?: string;
}

export function DraggableSheet({ children, title }: DraggableSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      drag={prefersReduced ? false : "y"}
      dragConstraints={{ top: -180, bottom: 0 }}
      dragElastic={0.12}
      onDragEnd={(_, info) => {
        if (info.offset.y < -40) setExpanded(true);
        else if (info.offset.y > 40) setExpanded(false);
      }}
      animate={{ y: expanded ? -40 : 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="relative -mt-6 z-20 bg-surface-container-low/90 backdrop-blur-2xl border-t border-white/15 rounded-t-3xl shadow-[0_-12px_36px_rgba(0,0,0,0.55)] px-4 pt-3 pb-6"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-label="Toggle bottom sheet height"
        className="w-full flex flex-col items-center justify-center min-h-[44px] -mt-2 mb-1 cursor-grab active:cursor-grabbing"
      >
        <span className="w-12 h-1.5 rounded-full bg-surface-container-highest mb-1.5" />
        {title && (
          <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
            {title}
          </span>
        )}
      </button>
      {children}
    </motion.div>
  );
}
