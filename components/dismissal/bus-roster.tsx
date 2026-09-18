"use client";

import { useState } from "react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogOut,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useOperationalDate } from "@/hooks/use-operational-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const studentStatusStyles = {
  dropped_off: {
    color:
      "border-info/30 bg-info-soft",
    Icon: LogOut,
  },
  pending: {
    color:
      "border-border bg-card",
    Icon: Clock,
  },
  boarded: {
    color:
      "border-success/30 bg-success-soft",
    Icon: Check,
  },
  not_traveling: {
    color:
      "border-destructive/30 bg-destructive-soft",
    Icon: UserX,
  },
  picked_up_early: {
    color: "border-info/30 bg-info-soft",
    Icon: UserCheck,
  },
  departed: {
    color:
      "border-primary/30 bg-secondary",
    Icon: LogOut,
  },
};

function BoardingControls({
  studentId,
  campus,
  date,
  state,
}: {
  studentId: Id<"students">;
  campus: string;
  date: string;
  state: Doc<"studentDismissals"> | null;
}) {
  const t = useTranslations("transport");
  const setStatus = useMutation(api.studentDismissals.setStatus);
  const setDropoff = useMutation(api.studentDismissals.setDropoff);
  const [reason, setReason] = useState("");
  const [editingReason, setEditingReason] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = state?.status ?? "pending";
  const hasBoarded =
    status === "boarded" ||
    (status === "departed" && state?.vehicleType === "bus");
  async function save(
    status: "boarded" | "not_traveling" | "pending" | "dropoff" | "undoDropoff",
  ) {
    if (busy || (status === "not_traveling" && !reason.trim())) return;
    setBusy(true);
    setError("");
    try {
      if (status === "dropoff" || status === "undoDropoff") {
        await setDropoff({
          campus,
          date,
          studentId,
          expectedRevision: state?.revision ?? 0,
          droppedOff: status === "dropoff",
        });
      } else {
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
      }
      setEditingReason(null);
      setReason("");
    } catch (error) {
      setError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  if ((status === "departed" && !hasBoarded) || status === "picked_up_early")
    return null;
  return (
    <>
      <ToggleGroup
        aria-label={t("boardingStatus")}
        className="col-start-2 row-start-1 flex items-start gap-1 self-start"
        multiple={hasBoarded}
        disabled={busy}
        value={
          hasBoarded
            ? ["boarded", ...(state?.dropoff ? ["dropoff"] : [])]
            : status === "pending"
              ? []
              : [status]
        }
        onValueChange={(values) => {
          if (busy) return;
          if (hasBoarded) {
            if (!values.includes("boarded")) {
              if (status === "boarded" && !state?.dropoff) void save("pending");
            } else if (values.includes("dropoff") !== !!state?.dropoff) {
              void save(values.includes("dropoff") ? "dropoff" : "undoDropoff");
            }
            return;
          }
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
        {hasBoarded && (
          <Toggle
            key="dropoff"
            value="dropoff"
            render={<Button size="icon" variant="outline" />}
            aria-label={t(state?.dropoff ? "undoDropoff" : "markDroppedOff")}
            title={t(state?.dropoff ? "undoDropoff" : "markDroppedOff")}
            disabled={busy}
            className="border-info/40 text-info hover:bg-info-soft hover:text-info data-pressed:border-info data-pressed:bg-info data-pressed:text-info-foreground motion-safe:animate-slide-in-left motion-safe:animate-duration-200 motion-safe:animate-slide-distance-[100%]"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Toggle>
        )}
        <Toggle
          key="boarding"
          value="boarded"
          render={<Button size="icon" variant="outline" />}
          aria-label={t(
            hasBoarded && status !== "departed" && !state?.dropoff
              ? "undo"
              : "markBoarded",
          )}
          title={t(
            hasBoarded && status !== "departed" && !state?.dropoff
              ? "undo"
              : "markBoarded",
          )}
          disabled={busy || !!state?.dropoff || status === "departed"}
          className={`border-success/40 text-success hover:bg-success-soft hover:text-success data-pressed:border-success data-pressed:bg-success data-pressed:text-success-foreground motion-safe:animate-duration-200 motion-safe:animate-slide-distance-[100%] ${hasBoarded ? "motion-safe:animate-slide-in-left" : "motion-safe:animate-slide-in-right"}`}
        >
          <Check className="size-4" aria-hidden="true" />
        </Toggle>
        {!hasBoarded && (
          <Toggle
            key="not-traveling"
            value="not_traveling"
            render={<Button size="icon" variant="outline" />}
            aria-label={t("notTraveling")}
            title={t(status === "not_traveling" ? "undo" : "notTraveling")}
            disabled={busy}
            className="border-destructive/40 text-destructive hover:bg-destructive-soft hover:text-destructive data-pressed:border-destructive data-pressed:bg-destructive data-pressed:text-destructive-foreground"
          >
            <UserX className="size-4" aria-hidden="true" />
          </Toggle>
        )}
      </ToggleGroup>
      {editingReason !== null && !hasBoarded && (
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
  showDate = false,
}: {
  campus: string;
  carNumber: number | string;
  timezone: string;
  showDate?: boolean;
}) {
  const t = useTranslations("transport");
  const tCar = useTranslations("dismissal.car");
  const today = useOperationalDate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? today;
  const isToday = date === today;
  function changeDate(value: string | null) {
    if (value && value <= today)
      setSelectedDate(value === today ? null : value);
  }
  const roster = useQuery(api.studentDismissals.getRoster, {
    campus,
    carNumber,
    date,
    historical: !isToday,
  });
  if (!roster) return <p role="status">{t("loading")}</p>;
  const pendingCount = roster.students.filter(
    (student) => !student.state || student.state.status === "pending",
  ).length;
  const boardedCount = roster.students.filter(
    (student) =>
      !student.otherPickup && !student.state?.dropoff &&
      (student.state?.status === "boarded" ||
        student.state?.status === "departed"),
  ).length;
  const expectedCount =
    pendingCount +
    boardedCount +
    roster.students.filter((student) => !student.otherPickup && student.state?.dropoff).length;
  const boardingProgressLabel = t("boardingProgress", {
    boarded: boardedCount,
    total: expectedCount,
  });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Users
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <h3
            aria-live="polite"
            aria-label={boardingProgressLabel}
            title={boardingProgressLabel}
            className={
              showDate
                ? "truncate text-base font-semibold sm:text-lg"
                : "text-lg font-semibold"
            }
          >
            {tCar("students")} ({boardedCount}/{expectedCount})
          </h3>
        </div>
        {showDate && (
          <div
            className="ml-auto flex shrink-0 items-center gap-0.5 whitespace-nowrap"
            role="group"
            aria-label={t("dateNavigation")}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setSelectedDate(null)}
              disabled={isToday}
            >
              {t("today")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("previousDay")}
              className="size-6"
              disabled={!roster.previousDate}
              onClick={() => changeDate(roster.previousDate)}
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("nextDay")}
              className="size-6"
              disabled={!roster.nextDate}
              onClick={() => changeDate(roster.nextDate)}
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
            <time
              dateTime={date}
              className="ml-1 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {date}
            </time>
          </div>
        )}
      </div>
      {!roster.students.length && <p>{t("noStudents")}</p>}
      <ul className="space-y-3">
        {roster.students.map((student) => {
          const status = student.state?.dropoff
            ? "dropped_off"
            : (student.state?.status ?? "pending");
          const { color, Icon } = studentStatusStyles[status];
          return (
            <li
              key={`${campus}-${date}-${student.id}`}
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
              {isToday && roster.canEdit && !student.otherPickup && (
                <BoardingControls
                  studentId={student.id}
                  campus={campus}
                  date={date}
                  state={student.state}
                />
              )}
              {student.state && status !== "pending" && (
                <div className="col-span-2 space-y-1 break-words text-xs text-muted-foreground">
                  {student.otherPickup && <p>{t("alreadyPickedUp")}{student.state.vehicleIdentifier ? ` · ${student.state.vehicleIdentifier}` : ""}</p>}
                  {student.state.collectedBy && (
                    <p>
                      {t("collectedBy")}: {student.state.collectedBy}
                    </p>
                  )}
                  {student.state.reason && <p>{student.state.reason}</p>}
                  {(student.state.boarding || student.state.dropoff
                    ? [
                        student.state.boarding && {
                          ...student.state.boarding,
                          label: "markBoarded",
                        },
                        student.state.dropoff && {
                          ...student.state.dropoff,
                          label: "markDroppedOff",
                        },
                      ].filter((event) => !!event)
                    : [
                        {
                          at: student.state.updatedAt,
                          byName: student.state.updatedByName,
                          label: "",
                        },
                      ]
                  ).map((event) => (
                    <p key={event.label}>
                      {event.label && <>{t(event.label)} · </>}
                      {event.byName} ·{" "}
                      {new Intl.DateTimeFormat(undefined, {
                        timeZone: timezone,
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(event.at)}
                    </p>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
