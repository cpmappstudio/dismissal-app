import { cn } from "@/lib/utils";

/** Decorative brand shapes; never participate in layout or pointer interaction. */
export function BrandWaves({ className, variant = "footer" }: { className?: string; variant?: "footer" | "sign-in" }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox={variant === "sign-in" ? "0 0 820 480" : "0 0 1440 180"} preserveAspectRatio="none" className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full sm:h-40", className)}>
      {variant === "sign-in" ? <>
        <path fill="var(--brand-sun)" d="M0 0C130 70 230 220 280 365L0 330Z" />
        <path fill="var(--brand-aqua)" d="M0 300C110 240 200 430 420 390S560 445 660 450L720 480H0Z" />
        <path fill="var(--info)" d="M0 230C130 310 210 340 355 480H0Z" />
        <path fill="var(--brand-sun)" d="M530 480C515 452 530 440 570 435L775 400Q830 375 806 460L800 480Z" />
      </> : <>
      <path fill="var(--brand-sun)" d="M0 140C260 180 520 130 760 155S1160 40 1440 60V180H0Z" />
      <path fill="var(--primary)" opacity=".8" d="M0 120C200 0 330 35 560 100S1000 180 1440 120V180H0Z" />
      <path fill="var(--brand-aqua)" d="M0 75C200 100 250 185 540 145S1100 95 1440 180H0Z" />
      </>}
    </svg>
  );
}
