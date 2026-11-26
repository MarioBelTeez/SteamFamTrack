import type { MonthlySnapshotRecord } from "./types";

export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
export const WEEK_KEY_REGEX = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

export type SnapshotPeriodMode = "monthly" | "weekly";

export interface MemberStreakStatus {
  kind: "buying" | "dry";
  count: number;
  latestGamesDelta: number;
  latestValueDelta: number;
}

export function isValidSnapshotPeriod(value: string): boolean {
  const trimmed = value.trim();
  return MONTH_KEY_REGEX.test(trimmed) || WEEK_KEY_REGEX.test(trimmed);
}

export function getMonthKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Computes ISO-8601 week key (`YYYY-Www`) in UTC.
 */
export function getIsoWeekKey(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function filterSnapshotsByMode(
  snapshots: MonthlySnapshotRecord[],
  mode: SnapshotPeriodMode
): MonthlySnapshotRecord[] {
  const regex = mode === "weekly" ? WEEK_KEY_REGEX : MONTH_KEY_REGEX;
  return [...snapshots]
    .filter((s) => regex.test(s.snapshotMonth))
    .sort((a, b) => b.snapshotMonth.localeCompare(a.snapshotMonth));
}

/**
 * Computes consecutive buying (`gamesDelta > 0`) or dry-spell (`gamesDelta <= 0`)
 * streaks across consecutive snapshots (newest first).
 */
export function computeMemberStreaks(
  snapshotsDesc: MonthlySnapshotRecord[]
): Map<string, MemberStreakStatus> {
  const result = new Map<string, MemberStreakStatus>();
  if (snapshotsDesc.length < 2) return result;

  const latest = snapshotsDesc[0];
  for (const member of latest.memberBreakdown) {
    const prevLatest = snapshotsDesc[1].memberBreakdown.find(
      (m) => m.name === member.name
    );
    const latestGamesDelta = member.totalGames - (prevLatest?.totalGames ?? 0);
    const latestValueDelta =
      Math.round((member.totalRawValue - (prevLatest?.totalRawValue ?? 0)) * 100) /
      100;

    const kind: "buying" | "dry" = latestGamesDelta > 0 ? "buying" : "dry";
    let count = 0;

    for (let i = 0; i < snapshotsDesc.length - 1; i++) {
      const curr = snapshotsDesc[i].memberBreakdown.find(
        (m) => m.name === member.name
      );
      const prev = snapshotsDesc[i + 1].memberBreakdown.find(
        (m) => m.name === member.name
      );
      if (!curr || !prev) break;

      const delta = curr.totalGames - prev.totalGames;
      const matches = kind === "buying" ? delta > 0 : delta <= 0;
      if (!matches) break;
      count += 1;
    }

    if (count > 0) {
      result.set(member.name, {
        kind,
        count,
        latestGamesDelta,
        latestValueDelta,
      });
    }
  }

  return result;
}
