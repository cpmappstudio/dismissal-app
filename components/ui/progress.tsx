"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  ...props
}: Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, "className"> & { className?: string }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative w-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Track data-slot="progress-track" className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
