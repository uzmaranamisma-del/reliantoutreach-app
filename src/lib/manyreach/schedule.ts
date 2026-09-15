import { AppError } from "@/lib/errors";
export function validateSchedule(schedule: Record<string, unknown>) {
  if (!schedule.scheduleSending) return;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (!days.some((day) => schedule[`send${day}`]))
    throw new AppError(422, "Enable at least one sending day.");
  for (const day of days) {
    if (!schedule[`send${day}`]) continue;
    const after = schedule[`send${day}After`],
      before = schedule[`send${day}Before`];
    if (
      typeof after !== "number" ||
      typeof before !== "number" ||
      !Number.isInteger(after) ||
      !Number.isInteger(before) ||
      after < 0 ||
      before > 1440 ||
      after >= before
    )
      throw new AppError(
        422,
        "Each enabled day needs valid start and end times, with the end after the start.",
      );
  }
}
