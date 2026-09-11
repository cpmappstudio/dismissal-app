import { Car } from "@/components/dismissal/car";

export function BusHero() {
  return (
    <div
      aria-hidden="true"
      className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-background"
    >
      <Car
        vehicleType="bus"
        size="xl"
        className="rotate-90 transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}
