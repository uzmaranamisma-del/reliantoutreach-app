export const REMINDER_INTERVAL = 7 * 86400000;
export function reminderDue(last: string | null, now = Date.now()) {
  const value = Number(last);
  return (
    !last ||
    !Number.isFinite(value) ||
    value <= 0 ||
    now - value >= REMINDER_INTERVAL
  );
}
export type MobileRelease = {
  version: string;
  build: number;
  notes: string;
};
export function newerRelease(
  value: unknown,
  installedBuild: string | null,
): MobileRelease | null {
  if (
    !value ||
    typeof value !== "object" ||
    !installedBuild ||
    !/^\d+$/.test(installedBuild)
  )
    return null;
  const release = value as MobileRelease;
  if (
    !Number.isSafeInteger(release.build) ||
    release.build <= Number(installedBuild) ||
    typeof release.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    typeof release.notes !== "string" ||
    release.notes.length > 1000
  )
    return null;
  return {
    version: release.version,
    build: release.build,
    notes: release.notes,
  };
}
