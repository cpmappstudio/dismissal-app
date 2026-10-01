"use client";

import { useId, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { orderBusStudents } from "@/lib/bus-roster-order";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Roster = FunctionReturnType<typeof api.studentDismissals.getRoster>;
type Student = Roster["students"][number];
type RenderStudent = (student: Student, handle?: ReactNode) => ReactNode;
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function BusRosterOrder({
  roster,
  students: displayedStudents = roster.students,
  campus,
  carNumber,
  date,
  journey,
  renderStudent,
}: {
  roster: Roster;
  students?: Student[];
  campus: string;
  carNumber: number | string;
  date: string;
  journey?: "to_school";
  renderStudent: RenderStudent;
}) {
  const t = useTranslations("transport.order");
  const id = useId();
  const [drag, setDrag] = useState<{
    student: Student;
    ids: Student["id"][];
    baseIds: Student["id"][];
    revision: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const reorder = useMutation(
    api.studentDismissals.reorderRoster,
  ).withOptimisticUpdate((store, args) => {
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.studentDismissals.getRoster,
    )) {
      if (
        value &&
        queryArgs.campus === args.campus &&
        queryArgs.carNumber === args.carNumber &&
        queryArgs.journey === args.journey &&
        queryArgs.date === args.date &&
        !queryArgs.historical
      ) {
        store.setQuery(api.studentDismissals.getRoster, queryArgs, {
          ...value,
          students: orderBusStudents(value.students, args.studentIds),
          orderRevision: args.expectedRevision + 1,
        });
      }
    }
  });
  // Freeze only the order during a drag; attendance remains live. The server
  // rejects a stale order/membership instead of overwriting another user's edit.
  const students = drag
    ? orderBusStudents(roster.students, drag.ids)
    : displayedStudents;
  const ids = students.map((student) => student.id);
  const baseIds = roster.students.map((student) => student.id);
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("picked", {
        name: students.find((s) => s.id === active.id)?.name ?? "",
        position: ids.indexOf(active.id as Student["id"]) + 1,
        total: ids.length,
      }),
    onDragOver: ({ active, over }) =>
      over
        ? t("moved", {
            name: students.find((s) => s.id === active.id)?.name ?? "",
            position: ids.indexOf(over.id as Student["id"]) + 1,
            total: ids.length,
          })
        : undefined,
    onDragEnd: () => t("dropped"),
    onDragCancel: () => t("cancelled"),
  };

  async function save(studentIds: Student["id"][], expectedRevision: number) {
    setSaving(true);
    setError("");
    try {
      await reorder({
        campus,
        carNumber,
        date,
        journey,
        studentIds,
        expectedRevision,
      });
    } catch (error) {
      const code =
        error instanceof ConvexError &&
        typeof error.data === "object" &&
        error.data !== null
          ? error.data.code
          : null;
      setError(
        t(
          code === "ROSTER_ORDER_CHANGED" || code === "ROSTER_CHANGED"
            ? "conflict"
            : code === "ROSTER_DAY_CHANGED"
              ? "dayChanged"
              : "failed",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <span role="status" className="sr-only">
        {saving ? t("saving") : ""}
      </span>
      <DndContext
        id={id}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("instructions") },
        }}
        onDragStart={({ active }) => {
          const student = students.find((s) => s.id === active.id);
          if (student && !saving) {
            setError("");
            setDrag({ student, ids, baseIds, revision: roster.orderRevision });
          }
        }}
        onDragCancel={() => setDrag(null)}
        onDragEnd={({ active, over }) => {
          const snapshot = drag;
          setDrag(null);
          if (!snapshot || !over || saving || active.id === over.id) return;
          const from = snapshot.baseIds.indexOf(active.id as Student["id"]);
          const to = snapshot.baseIds.indexOf(over.id as Student["id"]);
          if (from >= 0 && to >= 0)
            void save(arrayMove(snapshot.baseIds, from, to), snapshot.revision);
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3" aria-busy={saving}>
            {students.map((student, index) => (
              <SortableStudent
                key={student.id}
                student={student}
                disabled={saving}
                renderStudent={renderStudent}
                first={index === 0}
                last={index === students.length - 1}
                onMove={(offset) => {
                  if (!saving && !drag)
                    void save(
                      arrayMove(
                        baseIds,
                        baseIds.indexOf(student.id),
                        baseIds.indexOf(ids[index + offset]),
                      ),
                      roster.orderRevision,
                    );
                }}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {drag && (
            <div
              inert
              className="pointer-events-none rounded-lg shadow-lg ring-2 ring-primary"
            >
              {renderStudent(
                drag.student,
                <span className="flex size-11 shrink-0 items-center justify-center">
                  <GripVertical className="size-4" />
                </span>,
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableStudent({
  student,
  disabled,
  renderStudent,
  first,
  last,
  onMove,
}: {
  student: Student;
  disabled: boolean;
  renderStudent: RenderStudent;
  first: boolean;
  last: boolean;
  onMove: (offset: number) => void;
}) {
  const t = useTranslations("transport.order");
  const [open, setOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: student.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`motion-reduce:!transition-none ${isDragging ? "opacity-30" : ""}`}
    >
      {renderStudent(
        student,
        <Popover open={open && !isDragging && !disabled} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={setActivatorNodeRef}
              type="button"
              variant="ghost"
              size="icon"
              {...attributes}
              {...listeners}
              disabled={disabled}
              aria-label={t("handle", { name: student.name })}
              title={t("handle", { name: student.name })}
              className="size-11 shrink-0 touch-manipulation cursor-grab text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-1">
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                disabled={first || disabled}
                onClick={() => {
                  setOpen(false);
                  onMove(-1);
                }}
              >
                <ArrowUp aria-hidden="true" />
                {t("up")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={last || disabled}
                onClick={() => {
                  setOpen(false);
                  onMove(1);
                }}
              >
                <ArrowDown aria-hidden="true" />
                {t("down")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>,
      )}
    </li>
  );
}
