// Unassigned/new students retain their existing relative order after saved stops.
export function orderBusStudents<T extends { id: string }>(
  students: readonly T[],
  ids: readonly string[],
) {
  const positions = new Map(ids.map((id, index) => [id, index]));
  return [...students].sort(
    (a, b) =>
      (positions.get(a.id) ?? ids.length) - (positions.get(b.id) ?? ids.length),
  );
}

type JourneyStudent = {
  id: string;
  otherPickup?: boolean;
  journeyBlocked?: boolean;
  state: {
    status: string;
    updatedAt?: number;
    boarding?: { at: number };
    dropoff?: { at: number };
  } | null;
};

export function busJourneyProgress<T extends JourneyStudent>(
  students: readonly T[],
  journey?: "to_school",
) {
  const finished = (s: T) =>
    !!s.otherPickup ||
    !!s.state?.dropoff ||
    s.state?.status === "not_traveling" ||
    s.state?.status === "picked_up_early";
  const complete = students.length > 0 && students.every(finished);
  const resolved = (s: T) =>
    finished(s) || (journey === "to_school" && s.state?.status === "boarded");
  const next = students.find((s) => !resolved(s) && !s.journeyBlocked)?.id;
  const priority = (s: T) => (resolved(s) ? 2 : s.journeyBlocked ? 1 : 0);
  const eventTime = (s: T) =>
    (journey === "to_school" ? s.state?.boarding?.at : s.state?.dropoff?.at) ??
    s.state?.updatedAt ??
    0;
  const ordered = complete
    ? [...students]
    : [...students].sort(
        (a, b) =>
          priority(a) - priority(b) ||
          (resolved(a) ? eventTime(a) - eventTime(b) : 0),
      );
  const canArrive =
    students.length > 0 &&
    students.every((s) => !!s.state && s.state.status !== "pending") &&
    students.some(
      (s) =>
        !s.otherPickup &&
        !s.journeyBlocked &&
        !s.state?.dropoff &&
        s.state?.status === "boarded",
    );
  return { students: ordered, next, complete, canArrive };
}
