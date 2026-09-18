import { cn } from "@/lib/utils";

/** Decorative brand shapes; never participate in layout or pointer interaction. */
export function BrandWaves({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 1440 180" preserveAspectRatio="none" className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full sm:h-40", className)}>
      <path fill="var(--brand-sun)" d="M0 140C260 180 520 130 760 155S1160 40 1440 60V180H0Z" />
      <path fill="var(--primary)" opacity=".8" d="M0 120C200 0 330 35 560 100S1000 180 1440 120V180H0Z" />
      <path fill="var(--brand-aqua)" d="M0 75C200 100 250 185 540 145S1100 95 1440 180H0Z" />
    </svg>
  );
}
