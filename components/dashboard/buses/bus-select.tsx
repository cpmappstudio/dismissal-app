"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export function BusSelect({
  buses,
  value,
  onChange,
  disabled,
}: {
  buses: FunctionReturnType<typeof api.buses.options> | undefined;
  value: string;
  onChange: (identifier: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("buses");
  return (
    <div className="space-y-2">
      <Select
        value={
          buses?.some((bus) => String(bus.identifier) === value) ? value : ""
        }
        onValueChange={(identifier) => {
          // Radix's native form control can emit "" while async options mount.
          // There is no empty option: only an explicit bus selection changes the form.
          if (identifier) onChange(identifier);
        }}
        disabled={disabled || !buses?.length}
      >
        <SelectTrigger aria-label={t("select")} className="w-full">
          <SelectValue placeholder={t("select")} />
        </SelectTrigger>
        <SelectContent>
          {buses?.map((bus) => (
            <SelectItem
              key={String(bus.identifier)}
              value={String(bus.identifier)}
            >
              {bus.name} · {bus.identifier}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {buses?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noneAvailable")}</p>
      )}
    </div>
  );
}
