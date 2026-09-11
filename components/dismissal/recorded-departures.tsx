"use client";

import { useRef, useState, type RefObject } from "react";
import { Pencil } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useOperationalDate } from "@/hooks/use-operational-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function DepartureCorrection({ record, campus, date, portalContainer }: {
  record: Doc<"studentDismissals"> & { departureCampus: string }; campus: string; date: string;
  portalContainer: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("transport");
  const correctDeparture = useMutation(api.studentDismissals.correctDeparture);
  const setStatus = useMutation(api.studentDismissals.setStatus);
  const [selection, setSelection] = useState<typeof record | null>(null);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = selection?.date === date ? selection : null;
  return (
    <>
      <Popover.Root open={!!selected} onOpenChange={open => {
        if (busy || confirming) return;
        setSelection(open ? record : null);
        setReason("");
        setError("");
      }}>
        <Popover.Trigger render={<Button size="icon" variant="outline" />}
          aria-label={t("correctDepartureFor", { name: record.studentName })}
          title={t("correctDeparture")} disabled={busy}>
          <Pencil className="size-4" aria-hidden="true" />
        </Popover.Trigger>
        {/* Portals stay inside the sheet's focus boundary, without taking up layout space. */}
        <Popover.Portal container={portalContainer}>
          <Popover.Positioner positionMethod="fixed" align="end" sideOffset={8} className="z-50">
            <Popover.Popup className="w-80 max-w-[var(--available-width)] rounded-lg border bg-popover p-4 text-left text-popover-foreground shadow-md">
              <Popover.Title className="mb-3 font-semibold">{record.studentName}</Popover.Title>
              <form className="space-y-3" onSubmit={e => {
                e.preventDefault();
                if (!busy && selected && reason.trim()) setConfirming(true);
              }}>
                <div className="space-y-1">
                  <Label htmlFor={`departureReason-${record._id}`}>{t("correctionReason")}</Label>
                  <Input id={`departureReason-${record._id}`} value={reason} onChange={e => setReason(e.target.value)}
                    maxLength={500} required disabled={busy} />
                </div>
                <Button disabled={busy || !reason.trim()}>{t("undo")}</Button>
              </form>
              <AlertDialog.Root open={confirming && !!selected} onOpenChange={open => {
                if (!busy) setConfirming(open);
              }}>
                <AlertDialog.Portal container={portalContainer}>
                  <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
                  <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[60] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border bg-background p-6 text-left shadow-lg">
                    <AlertDialog.Title className="font-semibold">{t("correctDepartureFor", { name: record.studentName })}</AlertDialog.Title>
                    <AlertDialog.Description className="text-sm text-muted-foreground">{t(record.status === "picked_up_early" ? "pickupCorrectionDescription" : "departureCorrectionDescription")}</AlertDialog.Description>
                    <p className="break-words text-sm">{t("correctionReason")}: {reason}</p>
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <div className="flex justify-end gap-2">
                      <AlertDialog.Close render={<Button variant="outline" />} disabled={busy}>{t("cancel")}</AlertDialog.Close>
                      <Button disabled={busy} onClick={async () => {
                        if (busy || !selected || !reason.trim()) return;
                        setBusy(true);
                        setError("");
                        try {
                          if (selected.status === "picked_up_early") {
                            await setStatus({
                              campus: selected.departureCampus, date: selected.date,
                              studentId: selected.studentId, status: "pending",
                              expectedRevision: selected.revision, reason,
                            });
                          } else {
                            await correctDeparture({
                              campus, date: selected.date, departureId: selected._id,
                              expectedRevision: selected.revision, reason,
                            });
                          }
                          setConfirming(false);
                          setSelection(null);
                          setReason("");
                        } catch (error) {
                          setError(error instanceof Error ? error.message : t("saveError"));
                        } finally {
                          setBusy(false);
                        }
                      }}>{t("confirm")}</Button>
                    </div>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

export function RecordedDepartures({ campus, timezone }: { campus: string; timezone: string }) {
  const t = useTranslations("transport");
  const date = useOperationalDate();
  const portalContainer = useRef<HTMLDivElement>(null);
  const { results, status, loadMore } = usePaginatedQuery(
    api.studentDismissals.listRecordedDepartures, { campus, date }, { initialNumItems: 50 },
  );
  const canCorrect = results.some(record => record.canCorrect);
  return (
    <div ref={portalContainer} className="space-y-4">
      <h3 className="font-semibold">{t("recordedToday")}</h3>
      <Table aria-label={t("recordedToday")}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("student")}</TableHead>
            <TableHead>{t("vehicle")}</TableHead>
            {canCorrect && <TableHead><span className="sr-only">{t("actions")}</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map(record => (
            <TableRow key={record._id}>
              <TableCell className="whitespace-normal">
                <p className="font-medium">{record.studentName}</p>
                <p className="text-sm">{t(`status.${record.status}`)}</p>
                {record.collectedBy && <p className="text-sm">{t("collectedBy")}: {record.collectedBy}</p>}
                {record.reason && <p className="break-words text-sm">{record.reason}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(record.departure?.at ?? record.updatedAt)}
                  {" · "}{record.departure?.byName ?? record.updatedByName}
                </p>
                {record.departureCampus !== campus && <p className="text-xs text-muted-foreground">
                  {t("departureCampus", { campus: record.departureCampus })}
                </p>}
              </TableCell>
              <TableCell>{record.vehicleIdentifier ?? "—"}</TableCell>
              {canCorrect && <TableCell className="text-right">
                {record.canCorrect && <DepartureCorrection record={record} campus={campus} date={date} portalContainer={portalContainer} />}
              </TableCell>}
            </TableRow>
          ))}
          {!results.length && <TableRow><TableCell colSpan={canCorrect ? 3 : 2} className="whitespace-normal text-muted-foreground">
            <span role="status">{status === "LoadingFirstPage" ? t("loading") : status === "Exhausted" ? t("noDepartures") : t("moreDepartures")}</span>
          </TableCell></TableRow>}
        </TableBody>
      </Table>
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <Button variant="outline" disabled={status === "LoadingMore"} onClick={() => loadMore(50)}>
          {status === "LoadingMore" ? t("loading") : t("loadMore")}
        </Button>
      )}
    </div>
  );
}
