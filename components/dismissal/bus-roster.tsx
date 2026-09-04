"use client";

import { useState } from "react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Check, Clock, LogOut, UserCheck, Users, UserX } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useOperationalDate } from "@/hooks/use-operational-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const studentStatusStyles = {
  pending: {
    color:
      "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900",
    Icon: Clock,
  },
  boarded: {
    color:
      "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
    Icon: Check,
  },
  not_traveling: {
    color:
      "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
    Icon: UserX,
  },
  picked_up_early: {
    color: "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950",
    Icon: UserCheck,
  },
  departed: {
    color:
      "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950",
    Icon: LogOut,
  },
};

function BoardingControls({
  studentId,
  campus,
  date,
  state,
  inQueue,
}: {
  studentId: Id<"students">;
  campus: string;
  date: string;
  state: Doc<"studentDismissals"> | null;
  inQueue: boolean;
}) {
  const t = useTranslations("transport");
  const setStatus = useMutation(api.studentDismissals.setStatus);
  const [reason, setReason] = useState("");
  const [editingReason, setEditingReason] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = state?.status ?? "pending";
  async function save(status: "boarded" | "not_traveling" | "pending") {
    if (
      busy ||
      (status === "boarded" && !inQueue) ||
      (status === "not_traveling" && !reason.trim())
    )
      return;
    setBusy(true);
    setError("");
    try {
      await setStatus({
        campus,
        date,
        studentId,
        status,
        reason: status === "not_traveling" ? reason : undefined,
        expectedRevision:
          status === "not_traveling"
            ? (editingReason ?? 0)
            : (state?.revision ?? 0),
      });
      setEditingReason(null);
      setReason("");
    } catch (error) {
      setError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  if (status === "departed" || status === "picked_up_early") return null;
  return (
    <>
      <ToggleGroup
        aria-label={t("boardingStatus")}
        className="col-start-2 row-start-1 flex items-start gap-1 self-start"
        multiple={false}
        disabled={busy}
        value={status === "pending" ? [] : [status]}
        onValueChange={(values) => {
          if (busy) return;
          const next = values.length ? values[0] : "pending";
          if (next === "not_traveling") {
            setEditingReason(
              editingReason === null ? (state?.revision ?? 0) : null,
            );
            setReason("");
            setError("");
          } else if (next === "pending" || next === "boarded") {
            setEditingReason(null);
            void save(next);
          }
        }}
      >
        <Toggle
          value="boarded"
          render={<Button size="icon" variant="outline" />}
          aria-label={t("markBoarded")}
          title={t(status === "boarded" ? "undo" : "markBoarded")}
          disabled={busy || (!inQueue && status !== "boarded")}
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 data-pressed:border-emerald-600 data-pressed:bg-emerald-600 data-pressed:text-white dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900 dark:data-pressed:text-white"
        >
          <Check className="size-4" aria-hidden="true" />
        </Toggle>
        <Toggle
          value="not_traveling"
          render={<Button size="icon" variant="outline" />}
          aria-label={t("notTraveling")}
          title={t(status === "not_traveling" ? "undo" : "notTraveling")}
          disabled={busy}
          className="border-amber-300 text-amber-800 hover:bg-amber-100 data-pressed:border-amber-500 data-pressed:bg-amber-500 data-pressed:text-black dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900 dark:data-pressed:text-black"
        >
          <UserX className="size-4" aria-hidden="true" />
        </Toggle>
      </ToggleGroup>
      {editingReason !== null && (
        <form
          className="col-span-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save("not_traveling");
          }}
        >
          <Input
            aria-label={t("reason")}
            placeholder={t("reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            required
            disabled={busy}
          />
          <Button size="sm" disabled={busy || !reason.trim()}>
            {t("save")}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="col-span-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

export function BusRoster({
  campus,
  carNumber,
  timezone,
}: {
  campus: string;
  carNumber: number | string;
  timezone: string;
}) {
  const t = useTranslations("transport");
  const tCar = useTranslations("dismissal.car");
  const date = useOperationalDate();
  const roster = useQuery(api.studentDismissals.getRoster, {
    campus,
    carNumber,
    date,
  });
  if (!roster) return <p role="status">{t("loading")}</p>;
  const pendingCount = roster.students.filter(
    (student) => !student.state || student.state.status === "pending",
  ).length;
  const boardedCount = roster.students.filter(
    (student) => student.state?.status === "boarded",
  ).length;
  const expectedCount = pendingCount + boardedCount;
  const boardingProgressLabel = t("boardingProgress", {
    boarded: boardedCount,
    total: expectedCount,
  });
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-gray-600" aria-hidden="true" />
        <h3
          aria-live="polite"
          aria-label={boardingProgressLabel}
          title={boardingProgressLabel}
          className="text-lg font-semibold"
        >
          {tCar("students")} ({boardedCount}/{expectedCount})
        </h3>
      </div>
      {!roster.inQueue && (
        <p className="rounded border p-3 text-sm">{t("notInQueue")}</p>
      )}
      {!roster.students.length && <p>{t("noStudents")}</p>}
      <ul className="space-y-3">
        {roster.students.map((student) => {
          const status = student.state?.status ?? "pending";
          const { color, Icon } = studentStatusStyles[status];
          return (
            <li
              key={`${date}-${student.id}`}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border p-3 ${color}`}
            >
              <div className="flex min-w-0 gap-3">
                <Avatar>
                  <AvatarImage src={student.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback>{student.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium break-words">{student.name}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    {student.grade}
                    <span title={t(`status.${status}`)}>
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="sr-only">{t(`status.${status}`)}</span>
                    </span>
                  </p>
                </div>
              </div>
              {roster.canEdit && (
                <BoardingControls
                  studentId={student.id}
                  campus={campus}
                  date={date}
                  state={student.state}
                  inQueue={roster.inQueue}
                />
              )}
              {student.state && (
                <div className="col-span-2 space-y-1 break-words text-xs text-muted-foreground">
                  {student.state.collectedBy && (
                    <p>
                      {t("collectedBy")}: {student.state.collectedBy}
                    </p>
                  )}
                  {student.state.reason && <p>{student.state.reason}</p>}
                  <p>
                    {student.state.updatedByName} ·{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      timeZone: timezone,
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(student.state.updatedAt)}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
