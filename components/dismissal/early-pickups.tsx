"use client";

import { useRef, useState } from "react";
import { ChevronsUpDown, UserCheck } from "lucide-react";
import { Combobox } from "@base-ui/react/combobox";
import { RecordedDepartures } from "./recorded-departures";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useOperationalDate } from "@/hooks/use-operational-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

function PickupList({
  campus,
  timezone,
}: {
  campus: string;
  timezone: string;
}) {
  const t = useTranslations("transport");
  const date = useOperationalDate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<{
    id: Id<"students">;
    name: string;
    revision: number;
    date: string;
  } | null>(null);
  const [collectedBy, setCollectedBy] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = useQuery(api.studentDismissals.searchPickupStudents, {
    campus,
    date,
    search,
  });
  const setStatus = useMutation(api.studentDismissals.setStatus);
  return (
    <div ref={containerRef} className="space-y-4 p-4">
      <p className="text-sm">
        {campus} · {date}
      </p>
      <Combobox.Root
        items={data?.students.map(student => student.id) ?? []}
        filter={null}
        disabled={busy}
        value={selection?.id ?? null}
        itemToStringLabel={(id) => data?.students.find(student => student.id === id)?.name ?? selection?.name ?? ""}
        inputValue={search}
        onInputValueChange={(value, { reason }) => {
          setSearch(value);
          if (reason === "input-change") setSelection(null);
        }}
        onValueChange={(id) => {
          const student = data?.students.find(student => student.id === id);
          setSelection(student ? {
            id: student.id,
            name: student.name,
            revision: student.state?.revision ?? 0,
            date,
          } : null);
          setError("");
          setReason("");
          setCollectedBy("");
        }}
      >
        <Combobox.InputGroup className="relative">
          <Combobox.Input
            render={<Input className="pr-9" />}
            aria-label={t("searchStudents")}
            placeholder={t("searchStudents")}
            maxLength={100}
          />
          <Combobox.Trigger
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground focus-visible:outline-ring"
            aria-label={t("searchStudents")}
          >
            <ChevronsUpDown className="size-4" aria-hidden="true" />
          </Combobox.Trigger>
        </Combobox.InputGroup>
        {/* Keep the popup inside the sheet's focus and interaction boundary. */}
        <Combobox.Portal container={containerRef}>
          <Combobox.Positioner sideOffset={4} align="start" className="z-50">
            <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] rounded-md border bg-popover text-popover-foreground shadow-md">
              <Combobox.Empty className="p-3 text-sm text-muted-foreground">
                {search.trim().length < 2 ? t("searchStudentsHint") : !data ? t("loading") : t("noResults")}
              </Combobox.Empty>
              <Combobox.List className="max-h-[min(16rem,var(--available-height))] overflow-y-auto p-1 empty:p-0">
                {data?.students.map(student => (
                  <Combobox.Item
                    key={student.id}
                    value={student.id}
                    disabled={student.state?.status === "departed" || student.state?.status === "picked_up_early"}
                    className="cursor-default rounded-sm px-2 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50"
                  >
                    <span className="block font-medium">{student.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {student.grade} · {student.carNumber || "—"}
                      {student.state && <> · {t(`status.${student.state.status}`)}</>}
                    </span>
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {selection && (
        <form
          className="space-y-3 rounded-lg border p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await setStatus({
                campus,
                date: selection.date,
                studentId: selection.id,
                expectedRevision: selection.revision,
                status: "picked_up_early",
                collectedBy,
                reason,
              });
              setSelection(null);
              setSearch("");
            } catch (error) {
              setError(error instanceof Error ? error.message : t("saveError"));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold">{selection.name}</h3>
          <div className="space-y-1">
            <Label htmlFor="collectedBy">{t("collectedBy")}</Label>
            <Input
              id="collectedBy"
              value={collectedBy}
              onChange={(e) => setCollectedBy(e.target.value)}
              maxLength={150}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pickupReason">
              {t("optionalNote")}
            </Label>
            <Input
              id="pickupReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              disabled={busy}
            />
          </div>
          <div className="flex gap-2">
            <Button disabled={busy}>{t("confirm")}</Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSelection(null)}
            >
              {t("cancel")}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
      <RecordedDepartures campus={campus} timezone={timezone} />
    </div>
  );
}

export function EarlyPickups({
  campus,
  timezone,
}: {
  campus: string;
  timezone: string;
}) {
  const t = useTranslations("transport");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:w-auto md:px-4 border-2 border-yankees-blue hover:bg-yankees-blue/10"
          aria-label={t("earlyPickups")}
          title={t("earlyPickups")}
        >
          <UserCheck className="md:hidden" aria-hidden="true" />
          <span className="hidden md:inline">{t("earlyPickups")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t("earlyPickups")}</SheetTitle>
          <SheetDescription>{t("pickupDescription")}</SheetDescription>
        </SheetHeader>
        {open && (
          <PickupList key={campus} campus={campus} timezone={timezone} />
        )}
      </SheetContent>
    </Sheet>
  );
}
