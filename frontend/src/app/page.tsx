"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Tag,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

function AnimatedMetric({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let animationFrame = 0;
    let startTime: number | null = null;
    const duration = 1100;

    const update = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = value * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(update);
      }
    };

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  const formatted = decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue).toString();

  return (
    <span>
      {formatted}
      {suffix}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, ready } = useAuthStore();

  useEffect(() => {
    if (ready && isAuthenticated) router.push("/dashboard");
  }, [ready, isAuthenticated, router]);

  const STEPS = [
    {
      icon: <FileText className="h-5 w-5 text-[#193225]" />,
      label: "Request",
      desc: "Create & dispatch facility service requests",
    },
    {
      icon: <Tag className="h-5 w-5 text-[#C5A059]" />,
      label: "Quote",
      desc: "Receive & compare competitive provider estimates",
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-[#193225]" />,
      label: "Contract",
      desc: "Automate binding contracts & SLA terms",
    },
    {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      label: "Complete",
      desc: "Inspect proof of work & issue instant approvals",
    },
  ];

  return (
    <div className="min-h-screen bg-sand px-4 py-6 text-charcoal sm:px-6 lg:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine text-base font-bold text-brass shadow-sm">
            FF
          </div>
          <span className="text-2xl font-extrabold tracking-[-0.04em] text-charcoal">FacilityFlow</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <button className="rounded-xl border border-border bg-ivory px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-sand">
              Sign in
            </button>
          </Link>
          <Link href="/register">
            <button className="rounded-xl bg-brass px-4 py-2 text-sm font-semibold text-pine-darker transition hover:bg-[#d09544]">
              Get started
            </button>
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-8 flex w-full max-w-5xl flex-col items-center text-center">
        <div className="inline-flex items-center rounded-full border border-border bg-[#f2f5f5] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-pine">
          B2B Facility Operations Platform
        </div>

        <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[0.9] tracking-[-0.06em] text-charcoal sm:text-6xl lg:text-[6rem]">
          Reliable facility operations,
          <span className="block">run with clarity.</span>
        </h1>

        <p className="mt-6 max-w-4xl text-base leading-relaxed text-sage sm:text-[1.75rem] sm:leading-[1.35]">
          Connect with vetted service providers, manage requests and quotations, and track every job from schedule to approval — in one place.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register">
            <button className="flex items-center gap-2 rounded-xl border border-border bg-brass px-7 py-3 text-base font-bold text-pine-darker transition hover:bg-[#d09544]">
              Hire a Service <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <Link href="/register">
            <button className="rounded-xl bg-pine px-7 py-3 text-base font-bold text-ivory transition hover:bg-pine-light">
              Become a Provider
            </button>
          </Link>
        </div>

        <div className="mt-8 w-full max-w-4xl border-y border-border py-4 text-sm font-medium text-sage sm:text-base">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <span><AnimatedMetric value={50} suffix="+" /> verified providers</span>
            <span className="text-brass">•</span>
            <span><AnimatedMetric value={200} suffix="+" /> jobs completed</span>
            <span className="text-brass">•</span>
            <span><AnimatedMetric value={99.8} suffix="%" decimals={1} /> SLA rate</span>
            <span className="text-brass">•</span>
            <span>Trusted by facility teams</span>
          </div>
        </div>

        <div className="mt-12 w-full max-w-5xl text-left">
          <h2 className="text-4xl font-black tracking-[-0.05em] text-charcoal">How It Works</h2>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, idx) => (
              <div
                key={step.label}
                className="rounded-2xl border border-border bg-ivory p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-sand text-pine">
                    {step.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-brass">Step 0{idx + 1}</span>
                </div>
                <h3 className="text-3xl font-extrabold leading-none tracking-[-0.06em] text-charcoal">{step.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-sage">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="mx-auto mt-10 flex w-full max-w-6xl flex-col items-center justify-between gap-2 border-t border-border py-4 text-sm text-sage sm:flex-row">
        <span>© {new Date().getFullYear()} FacilityFlow. Enterprise Facility Operations.</span>
        <div className="flex gap-5 text-charcoal">
          <Link href="/login" className="hover:text-pine">Sign in</Link>
          <Link href="/register" className="hover:text-pine">Get started</Link>
        </div>
      </footer>
    </div>
  );
}
