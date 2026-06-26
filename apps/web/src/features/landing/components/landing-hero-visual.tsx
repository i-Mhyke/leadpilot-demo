import type { ReactNode } from "react";
import {
  ChatCircleDots,
  CheckCircle,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

const AVATAR_SRC = "https://picsum.photos/seed/leadpilot-hero/120/120";

function GlassCard({
  className,
  children,
}: Readonly<{
  className?: string;
  children: ReactNode;
}>) {
  return (
    <div
      className={[
        "landing-glass rounded-2xl border border-white/40 bg-white/45 p-3.5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_20px_50px_-28px_rgba(28,35,41,0.28)]",
        "backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function LandingHeroVisual() {
  return (
    <div className="landing-reveal landing-reveal-delay-3 relative mx-auto w-full max-w-6xl">
      <div className="landing-hero-stage relative aspect-16/10 overflow-hidden rounded-[2.75rem] border border-white/70 shadow-[0_32px_90px_-36px_rgba(28,35,41,0.22)]">
        <div className="landing-hero-mesh absolute inset-0" aria-hidden="true" />
        <div className="landing-hero-blob landing-hero-blob-a" aria-hidden="true" />
        <div className="landing-hero-blob landing-hero-blob-b" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden="true">
          <div className="absolute left-[10%] top-[16%] h-48 w-48 rounded-full border border-white/60" />
          <div className="absolute bottom-[12%] right-[8%] h-64 w-64 rounded-full border border-white/40" />
        </div>

        <div className="landing-hero-grain pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12">
          <div className="relative w-full max-w-[22rem] overflow-hidden rounded-[1.85rem] border border-zinc-200/70 bg-white/95 shadow-[0_28px_60px_-32px_rgba(28,35,41,0.38)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/80" />
            <div className="flex items-center gap-3 border-b border-zinc-100/90 px-4 py-3.5">
              <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-zinc-200/80">
                <img
                  src={AVATAR_SRC}
                  alt="Prospective client"
                  className="h-full w-full object-cover grayscale contrast-[1.05]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium tracking-tight text-zinc-900">
                  Maren Okonkwo
                </p>
                <p className="text-[11px] text-zinc-500">Personal injury enquiry</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                <span className="landing-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="space-y-2.5 px-4 py-4">
              <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-zinc-100/90 px-3 py-2.5 text-[13px] leading-relaxed text-zinc-700">
                I was in a car accident last week. Can someone review my case?
              </div>
              <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md border border-primary/10 bg-primary/[0.08] px-3 py-2.5 text-[13px] leading-relaxed text-zinc-800">
                I can help with that. When did the incident occur, and were you injured?
              </div>
            </div>
          </div>
        </div>

        <GlassCard className="landing-float-slow landing-reveal landing-reveal-delay-4 absolute left-[5%] top-[20%] hidden max-w-[228px] sm:block">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/60">
              <img
                src="https://picsum.photos/seed/leadpilot-card-a/64/64"
                alt="Staff member"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium tracking-tight text-zinc-900">
                Andrew Hale
              </p>
              <p className="text-[10px] text-zinc-500">New lead</p>
            </div>
            <span className="ml-auto rounded-full bg-emerald-100/90 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-800">
              11 new
            </span>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-zinc-600">
            Consultation request captured and routed to intake.
          </p>
        </GlassCard>

        <div className="landing-float-medium landing-reveal landing-reveal-delay-5 absolute right-[7%] top-[14%] hidden sm:flex">
          <GlassCard className="flex items-center gap-2 rounded-full px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Sparkle size={14} weight="fill" />
            </div>
            <span className="text-xs font-medium tracking-tight text-zinc-900">LeadPilot</span>
            <CheckCircle size={14} className="text-primary" weight="fill" />
            <span className="text-[10px] text-zinc-500">Co-pilot</span>
          </GlassCard>
        </div>

        <GlassCard className="landing-float-slow landing-reveal landing-reveal-delay-6 absolute bottom-[16%] right-[6%] hidden max-w-[248px] sm:block">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-zinc-700 ring-1 ring-white/50">
              <ChatCircleDots size={16} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium tracking-tight text-zinc-900">Intake automation</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <ShieldCheck size={10} weight="fill" />
                  Secure
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
                Qualify enquiries and surface booking-ready leads.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
