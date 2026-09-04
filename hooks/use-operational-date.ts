"use client";

import { useEffect, useState } from "react";
import { nextOperationalDay, operationalDate } from "@/lib/operational-day";

export function useOperationalDate() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const timestamp = Date.now();
      setNow(timestamp);
      clearTimeout(timer);
      timer = setTimeout(refresh, nextOperationalDay(timestamp) - timestamp);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return operationalDate(now);
}
