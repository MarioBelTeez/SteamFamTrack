import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GameInfo, MemberLibrary } from "./types";

const {
  analyzeFamily,
  computeSlotCooldown,
  simulateRosterChange,
  simulateSwap,
  splitIntoTwoFamilies,
} = (await import(`./analyzer${".ts"}`)) as typeof import("./analyzer");

function makeGame(
  appid: number,
  name: string,
  rawPrice: number,
  familySharingExcluded = false
): GameInfo {
  return {
    appid,
    name,
    rawPrice,
    isFree: rawPrice === 0,
    familySharingExcluded,
    headerImage: `https://example.com/${appid}.jpg`,
  };
}

function makeLibrary(
  id: string,
  name: string,
  games: GameInfo[],
  joinDate?: string
): MemberLibrary {
  return {
    member: {
      id,
      name,
      steamUrlOrId: `7656119800000000${id}`,
      joinDate,
    },
    steamId64: `7656119800000000${id}`,
    personaName: name,
    avatarUrl: "",
    profileUrl: `https://steamcommunity.com/profiles/7656119800000000${id}`,
    games,
    excludedCount: games.filter((g) => g.familySharingExcluded).length,
  };
}

describe("computeSlotCooldown", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("returns unlocked when no joinDate is provided", () => {
    const res = computeSlotCooldown(undefined, now);
    assert.deepEqual(res, {
      joinDate: null,
      slotUnlockDate: null,
      isSlotUnlocked: true,
      daysUntilUnlock: null,
    });
  });

  it("returns unlocked when joinDate is invalid", () => {
    const res = computeSlotCooldown("not-a-date", now);
    assert.deepEqual(res, {
      joinDate: null,
      slotUnlockDate: null,
      isSlotUnlocked: true,
      daysUntilUnlock: null,
    });
  });

  it("returns locked when joinDate is less than 1 year ago", () => {
    const res = computeSlotCooldown("2026-01-15", now);
    assert.equal(res.joinDate, "2026-01-15");
    assert.equal(res.slotUnlockDate, "2027-01-15");
    assert.equal(res.isSlotUnlocked, false);
    assert.equal(res.daysUntilUnlock, 214);
  });

  it("returns unlocked when joinDate is 1 year or more ago", () => {
    const exactYear = computeSlotCooldown("2025-06-15", now);
    assert.equal(exactYear.isSlotUnlocked, true);
    assert.equal(exactYear.daysUntilUnlock, 0);
    assert.equal(exactYear.slotUnlockDate, "2026-06-15");

    const older = computeSlotCooldown("2024-01-01", now);
    assert.equal(older.isSlotUnlocked, true);
    assert.equal(older.daysUntilUnlock, 0);
  });
});

describe("analyzeFamily", () => {
  it("handles empty members list cleanly", () => {
    const analysis = analyzeFamily([], "us");
    assert.equal(analysis.uniqueGamesCount, 0);
    assert.equal(analysis.uniqueCatalogValue, 0);
    assert.equal(analysis.members.length, 0);
    assert.deepEqual(analysis.fairness, {
      averageRawValue: 0,
      expectedSharePercent: 0,
      upNextMemberId: null,
      upNextMemberName: null,
      members: [],
    });
  });

  it("deduplicates games, computes exclusive vs shared counts, filters excluded games, and computes fairness", () => {
    const sharedGame = makeGame(100, "Elden Ring", 60);
    const aliceOnly = makeGame(101, "Hades", 25);
    const bobOnly = makeGame(102, "Balatro", 15);
    const excludedGame = makeGame(103, "GTA V", 30, true);

    const alice = makeLibrary("1", "Alice", [sharedGame, aliceOnly, excludedGame]);
    const bob = makeLibrary("2", "Bob", [sharedGame, bobOnly]);

    const analysis = analyzeFamily([alice, bob], "us", false);

    assert.equal(analysis.excludedGamesCount, 1);
    assert.equal(analysis.uniqueGamesCount, 3);
    assert.equal(analysis.uniqueCatalogValue, 100);
    assert.equal(analysis.sumCopiesCount, 4);
    assert.equal(analysis.sumCopiesValue, 160);

    // Members sorted descending by totalRawValue: Alice (85), Bob (75)
    assert.equal(analysis.members[0].name, "Alice");
    assert.equal(analysis.members[0].totalGames, 2);
    assert.equal(analysis.members[0].exclusiveGames, 1);
    assert.equal(analysis.members[0].sharedGames, 1);
    assert.equal(analysis.members[0].totalRawValue, 85);
    assert.equal(analysis.members[0].sharePercent, 53.13);

    assert.equal(analysis.members[1].name, "Bob");
    assert.equal(analysis.members[1].totalGames, 2);
    assert.equal(analysis.members[1].exclusiveGames, 1);
    assert.equal(analysis.members[1].sharedGames, 1);
    assert.equal(analysis.members[1].totalRawValue, 75);
    assert.equal(analysis.members[1].sharePercent, 46.88);

    // Fairness sorted ascending by totalRawValue: Bob first (up next)
    assert.equal(analysis.fairness.averageRawValue, 80);
    assert.equal(analysis.fairness.expectedSharePercent, 50);
    assert.equal(analysis.fairness.upNextMemberId, "2");
    assert.equal(analysis.fairness.upNextMemberName, "Bob");
    assert.equal(analysis.fairness.members[0].memberId, "2");
    assert.equal(analysis.fairness.members[0].isUpNext, true);
    assert.equal(analysis.fairness.members[0].deltaFromAverageValue, -5);
    assert.equal(analysis.fairness.members[0].deltaFromAveragePct, -3.12);
    assert.equal(analysis.fairness.members[1].memberId, "1");
    assert.equal(analysis.fairness.members[1].isUpNext, false);
    assert.equal(analysis.fairness.members[1].deltaFromAverageValue, 5);
    assert.equal(analysis.fairness.members[1].deltaFromAveragePct, 3.13);
  });
});

describe("simulateSwap", () => {
  it("computes games/value delta and share delta when swapping a member", () => {
    const shared = makeGame(1, "Portal 2", 10);
    const aliceExclusive = makeGame(2, "Cyberpunk 2077", 60);
    const bobExclusive = makeGame(3, "Celeste", 20);
    const charlieNew = makeGame(4, "Hollow Knight", 15);

    const alice = makeLibrary("1", "Alice", [shared, aliceExclusive], "2024-01-01");
    const bob = makeLibrary("2", "Bob", [shared, bobExclusive], "2025-01-01");
    const charlie = makeLibrary("3", "Charlie", [shared, charlieNew]);

    const result = simulateSwap(
      [alice, bob],
      "2",
      charlie,
      "us",
      false,
      new Date("2026-06-15T12:00:00Z")
    );

    assert.ok(result !== null);
    assert.equal(result.removedMemberId, "2");
    assert.equal(result.addedMemberId, "3");
    assert.equal(result.beforeUniqueGames, 3);
    assert.equal(result.afterUniqueGames, 3);
    assert.equal(result.uniqueGamesDelta, 0);
    assert.equal(result.beforeUniqueValue, 90);
    assert.equal(result.afterUniqueValue, 85);
    assert.equal(result.uniqueValueDelta, -5);

    const aliceDelta = result.shareDeltas.find((d) => d.memberId === "1");
    assert.ok(aliceDelta);
    assert.equal(aliceDelta.beforePct, 70);
    assert.equal(aliceDelta.afterPct, 73.68);
    assert.equal(aliceDelta.deltaPct, 3.68);

    const bobDelta = result.shareDeltas.find((d) => d.memberId === "2");
    assert.ok(bobDelta);
    assert.equal(bobDelta.beforePct, 30);
    assert.equal(bobDelta.afterPct, 0);
    assert.equal(bobDelta.deltaPct, -30);

    const charlieDelta = result.shareDeltas.find((d) => d.memberId === "3");
    assert.ok(charlieDelta);
    assert.equal(charlieDelta.beforePct, 0);
    assert.equal(charlieDelta.afterPct, 26.32);
    assert.equal(charlieDelta.deltaPct, 26.32);
  });
});

describe("simulateRosterChange", () => {
  it("supports multi-member swaps at once", () => {
    const g1 = makeGame(1, "Game 1", 20);
    const g2 = makeGame(2, "Game 2", 30);
    const g3 = makeGame(3, "Game 3", 40);
    const g4 = makeGame(4, "Game 4", 50);

    const a = makeLibrary("1", "A", [g1]);
    const b = makeLibrary("2", "B", [g2]);
    const c = makeLibrary("3", "C", [g3]);
    const d = makeLibrary("4", "D", [g4]);

    const res = simulateRosterChange([a, b], [c, d], "us");
    assert.equal(res.removedMembers.length, 2);
    assert.equal(res.addedMembers.length, 2);
    assert.equal(res.beforeUniqueGames, 2);
    assert.equal(res.afterUniqueGames, 2);
    assert.equal(res.beforeUniqueValue, 50);
    assert.equal(res.afterUniqueValue, 90);
    assert.equal(res.uniqueValueDelta, 40);
  });
});

describe("splitIntoTwoFamilies", () => {
  it("balances unique games in equal-games mode and maximizes Family A in stacked-main mode", () => {
    const m1 = makeLibrary("1", "M1", [makeGame(1, "G1", 50), makeGame(2, "G2", 50)]);
    const m2 = makeLibrary("2", "M2", [makeGame(3, "G3", 50), makeGame(4, "G4", 50)]);
    const m3 = makeLibrary("3", "M3", [makeGame(5, "G5", 10)]);
    const m4 = makeLibrary("4", "M4", [makeGame(6, "G6", 10)]);

    const balanced = splitIntoTwoFamilies([m1, m2, m3, m4], "equal-games");
    assert.ok(balanced !== null);
    assert.equal(balanced.gamesGap, 0);
    assert.equal(balanced.familyA.uniqueGamesCount, 3);
    assert.equal(balanced.familyB.uniqueGamesCount, 3);

    const stacked = splitIntoTwoFamilies([m1, m2, m3, m4], "stacked-main");
    assert.ok(stacked !== null);
    assert.ok(stacked.familyA.uniqueCatalogValue >= stacked.familyB.uniqueCatalogValue);
  });
});
