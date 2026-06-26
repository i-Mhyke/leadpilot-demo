import { LandingHeroVisual } from "./landing-hero-visual";

export function LandingHero() {
  return (
    <section className="landing-hero relative min-h-[100dvh] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(72vh,720px)] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(45,106,106,0.09),transparent_68%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1400px] px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-[46rem] text-center">
          <p className="landing-reveal text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Conversational lead intake
          </p>
          <h1 className="landing-reveal landing-reveal-delay-1 mt-5 text-[2.35rem] font-semibold tracking-[-0.035em] text-zinc-950 sm:text-5xl md:text-[3.65rem] md:leading-[1.04]">
            Turn every enquiry into a{" "}
            <span className="text-primary">qualified lead</span>
          </h1>
          <p className="landing-reveal landing-reveal-delay-2 mx-auto mt-6 max-w-[52ch] text-[15px] leading-[1.7] text-zinc-600 md:text-[17px]">
            LeadPilot answers client questions, captures the details your team needs, and
            routes booking-ready conversations without adding headcount.
          </p>
        </div>

        <div className="mt-14 md:mt-[4.5rem]">
          <LandingHeroVisual />
        </div>
      </div>
    </section>
  );
}
