import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MonthlySnapshotRecord } from "./types";

const {
  computeMemberStreaks,
  filterSnapshotsByMode,
  getIsoWeekKey,
  isValidSnapshotPeriod,
} = (await import(
  `./snapshot-periods${".ts"}`
)) as typeof import("./snapshot-periods");

function makeSnap(
  period: string,
  members: Array<{ name: string; totalGames: number; totalRawValue: number }>
): MonthlySnapshotRecord {
  return {
    id: period,
    snapshotMonth: period,
    region: "ma",
    uniqueGamesCount: members.reduce((s, m) => s + m.totalGames, 0),
    uniqueCatalogValue: members.reduce((s, m) => s + m.totalRawValue, 0),
    sumCopiesCount: 0,
    sumCopiesValue: 0,
    memberBreakdown: members.map((m) => ({
      name: m.name,
      steamId64: m.name,
      totalGames: m.totalGames,
      exclusiveGames: 0,
      totalRawValue: m.totalRawValue,
      sharePercent: 50,
    })),
    createdAt: "2026-11-26T00:00:00Z",
  };
}

describe("snapshot-periods", () => {
  it("validates both YYYY-MM and YYYY-Www period keys", () => {
    assert.equal(isValidSnapshotPeriod("2026-11"), true);
    assert.equal(isValidSnapshotPeriod("2026-W48"), true);
    assert.equal(isValidSnapshotPeriod("2026-W01"), true);
    assert.equal(isValidSnapshotPeriod("2026-13"), false);
    assert.equal(isValidSnapshotPeriod("2026-W54"), false);
  });

  it("computes ISO week keys accurately", () => {
    assert.equal(
      getIsoWeekKey(new Date("2026-11-26T09:00:00Z")),
      "2026-W48"
    );
  });

  it("computes consecutive buying and dry-spell streaks", () => {
    const snaps = filterSnapshotsByMode(
      [
        makeSnap("2026-W46", [
          { name: "Alice", totalGames: 10, totalRawValue: 100 },
          { name: "Bob", totalGames: 20, totalRawValue: 200 },
        ]),
        makeSnap("2026-W47", [
          { name: "Alice", totalGames: 12, totalRawValue: 130 },
          { name: "Bob", totalGames: 20, totalRawValue: 200 },
        ]),
        makeSnap("2026-W48", [
          { name: "Alice", totalGames: 14, totalRawValue: 160 },
          { name: "Bob", totalGames: 20, totalRawValue: 200 },
        ]),
      ],
      "weekly"
    );

    const streaks = computeMemberStreaks(snaps);
    assert.equal(streaks.get("Alice")?.kind, "buying");
    assert.equal(streaks.get("Alice")?.count, 2);
    assert.equal(streaks.get("Bob")?.kind, "dry");
    assert.equal(streaks.get("Bob")?.count, 2);
  });
});
