"use client";

import Link from "next/link";
import { useState } from "react";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const isSmall = size === "sm";
  const iconClassName = isSmall ? "h-10 w-10" : "h-20 w-20";
  const cvClassName = isSmall ? "text-[2.15rem]" : "text-[4.5rem]";
  const mojoClassName = isSmall ? "text-[2.15rem]" : "text-[4.5rem]";
  const gapClassName = isSmall ? "gap-3" : "gap-5";

  return (
    <div className={`inline-flex items-center whitespace-nowrap ${gapClassName}`}>
      <svg
        viewBox="0 0 112 112"
        aria-hidden="true"
        className={`shrink-0 ${iconClassName}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cvmojo-stroke" x1="18" y1="20" x2="88" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
          <linearGradient id="cvmojo-wand" x1="52" y1="62" x2="83" y2="97" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C3AED" />
            <stop offset="1" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <path
          d="M27 30C27 25.5817 30.5817 22 35 22H66C70.4183 22 74 25.5817 74 30V74C74 78.4183 70.4183 82 66 82H35C30.5817 82 27 78.4183 27 74V30Z"
          stroke="url(#cvmojo-stroke)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M40 42H58" stroke="url(#cvmojo-stroke)" strokeWidth="5" strokeLinecap="round" />
        <path d="M40 54H62" stroke="url(#cvmojo-stroke)" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
        <path d="M40 66H58" stroke="url(#cvmojo-stroke)" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
        <path d="M55 23L65 10L72 23H55Z" fill="#8B5CF6" />
        <path d="M46 28C54 26 63 26 81 31C73 36 58 37 43 33L46 28Z" fill="#5B21B6" />
        <path
          d="M62 63C63.7 61.3 66.5 61.3 68.2 63L71.7 66.5C73.4 68.2 73.4 71 71.7 72.7L53.7 90.7C52 92.4 49.2 92.4 47.5 90.7L44 87.2C42.3 85.5 42.3 82.7 44 81L62 63Z"
          fill="url(#cvmojo-wand)"
          transform="rotate(-10 57 77)"
        />
        <path
          d="M80 48L83.5 56L91.5 59.5L83.5 63L80 71L76.5 63L68.5 59.5L76.5 56L80 48Z"
          fill="#8B5CF6"
        />
        <path
          d="M90 68L91.5 72L95.5 73.5L91.5 75L90 79L88.5 75L84.5 73.5L88.5 72L90 68Z"
          fill="#A78BFA"
        />
        <path
          d="M72 58L73 61L76 62L73 63L72 66L71 63L68 62L71 61L72 58Z"
          fill="#EC4899"
        />
        <path
          d="M58 8L60 13L65 15L60 17L58 22L56 17L51 15L56 13L58 8Z"
          fill="#F5F3FF"
        />
      </svg>
      <span className="inline-flex items-baseline">
        <span
          className={`bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] bg-clip-text font-black tracking-[-0.05em] text-transparent ${cvClassName}`}
        >
          CV
        </span>
        <span className={`font-black tracking-[-0.06em] text-[#1e1b2e] ${mojoClassName}`}>Mojo</span>
      </span>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Logo />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export function AppHeader({
  children,
  tagline,
}: {
  children?: React.ReactNode;
  tagline?: string;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Logo size="sm" />
        {tagline && <p className="mt-2 text-sm text-slate-500">{tagline}</p>}
      </div>
      {children}
    </header>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const styles = {
    primary: "bg-[#7c3aed] text-white hover:bg-[#5b21b6]",
    secondary: "border border-[#7c3aed] bg-white text-[#5b21b6] hover:bg-[#f5f3ff]",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>}
      <input
        className={`w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm ${className}`}
        {...props}
      />
    </label>
  );
}

export function PasswordInput({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>}
      <div className="relative">
        <input
          className={`w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-12 text-sm ${className}`}
          {...props}
          type={visible ? "text" : "password"}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-700"
        >
          {visible ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M10.58 10.58a2 2 0 102.83 2.83"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9.88 5.09A10.94 10.94 0 0112 4.91c5 0 9.27 3.11 11 7.5a11.8 11.8 0 01-4.24 5.28M6.61 6.61A11.84 11.84 0 001 12.41a11.82 11.82 0 004.53 5.57A10.95 10.95 0 0012 19.91c1.63 0 3.18-.33 4.59-.92"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path
                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

export function Textarea({
  label,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>}
      <textarea
        className={`w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm ${className}`}
        {...props}
      />
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function SetupBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {message}
    </div>
  );
}
