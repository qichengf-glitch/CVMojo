"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export function StepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const active = step <= current;
        const isLast = step === total;
        return (
          <div key={step} className="flex items-center">
            <motion.div
              initial={reduce ? false : { scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                active ? "bg-[#7c3aed] text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {step}
            </motion.div>
            {!isLast && (
              <div
                className={`h-0.5 w-8 sm:w-12 ${step < current ? "bg-[#7c3aed]" : "bg-slate-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StepShell({
  children,
  onNext,
  onBack,
  onSkip,
  nextLabel = "Continue",
  skipLabel = "Skip for now",
  nextDisabled,
  showBack = true,
}: {
  children: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  skipLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: -24 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full max-w-xl"
    >
      {children}
      {onSkip && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-semibold text-slate-500 transition hover:text-[#7c3aed]"
          >
            {skipLabel}
          </button>
        </div>
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="rounded-full bg-[#7c3aed] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#5b21b6] disabled:bg-violet-300"
          >
            {nextLabel} →
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function FadeIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ExpandableSection({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
      >
        <span className="font-semibold text-slate-800">
          {title}
          {count !== undefined && (
            <span className="ml-2 rounded-full bg-[#f5f3ff] px-2 py-0.5 text-xs font-bold text-[#5b21b6]">
              {count}
            </span>
          )}
        </span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="border-t border-slate-100 px-5 py-4">{children}</div>
      </motion.div>
    </div>
  );
}
