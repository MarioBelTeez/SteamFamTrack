import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GameInfo, MemberLibrary } from "./types";

const { analyzeFamily } = (await import(
  `./analyzer${".ts"}`
)) as typeof import("./analyzer");
const {
  assignTierGrade,
  buildPowerRankings,
  computePowerScore,
  summarizeWaitlistLibrary,
} = (await import(
  `./leaderboard${".ts"}`
)) as typeof import("./leaderboard");

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

function makeLibrary(id: string, name: string, games: GameInfo[]): MemberLibrary {
  return {
    member: {
      id,
      name,
      steamUrlOrId: `7656119800000000${id}`,
    },
    steamId64: `7656119800000000${id}`,
    personaName: name,
    avatarUrl: "",
    profileUrl: `https://steamcommunity.com/profiles/7656119800000000${id}`,
    games,
    excludedCount: games.filter((g) => g.familySharingExcluded).length,
  };
}

describe("computePowerScore", () => {
  it("keeps USD formula exact and normalizes JPY so game counts stay meaningful", () => {
    assert.equal(computePowerScore(100, 10, 20, "us"), 160);
    // ¥15,000 (~$100 USD) should land near the same score as $100 USD, not 15,060
    const jpScore = computePowerScore(15000, 10, 20, "jp");
    assert.ok(jpScore >= 155 && jpScore <= 165, `expected ~160, got ${jpScore}`);
  });
});

describe("assignTierGrade", () => {
  it("assigns S/A/B/C thresholds and handles zero scores", () => {
    assert.equal(assignTierGrade(100, 100), "S");
    assert.equal(assignTierGrade(85, 100), "S");
    assert.equal(assignTierGrade(60, 100), "A");
    assert.equal(assignTierGrade(35, 100), "B");
    assert.equal(assignTierGrade(34, 100), "C");
    assert.equal(assignTierGrade(0, 100), "C");
    assert.equal(assignTierGrade(10, 0), "C");
  });
});

describe("summarizeWaitlistLibrary & buildPowerRankings", () => {
  it("computes netNewValue and respects includeExcluded flag", () => {
    const shared = makeGame(1, "Shared", 50);
    const brandNew = makeGame(2, "Brand New", 40);
    const excluded = makeGame(3, "Excluded", 60, true);
    const lib = makeLibrary("w1", "Challenger", [shared, brandNew, excluded]);

    const activeIds = new Set<number>([1]);

    const withoutExcluded = summarizeWaitlistLibrary(lib, activeIds, false);
    assert.equal(withoutExcluded.totalGames, 2);
    assert.equal(withoutExcluded.exclusiveGames, 1);
    assert.equal(withoutExcluded.totalRawValue, 90);
    assert.equal(withoutExcluded.netNewValue, 40);

    const withExcluded = summarizeWaitlistLibrary(lib, activeIds, true);
    assert.equal(withExcluded.totalGames, 3);
    assert.equal(withExcluded.exclusiveGames, 2);
    assert.equal(withExcluded.totalRawValue, 150);
    assert.equal(withExcluded.netNewValue, 100);
  });

  it("ranks active and waitlist members together by power score", () => {
    const active = makeLibrary("a1", "Alpha", [makeGame(1, "Game A", 40)]);
    const bench = makeLibrary("w1", "Beta", [
      makeGame(2, "Game B", 120),
      makeGame(3, "Game C", 60),
    ]);
    const analysis = analyzeFamily([active], "us", false);
    const activeIds = new Set(analysis.catalog.map((c) => c.game.appid));
    const waitlistSummaries = [
      { lib: bench, ...summarizeWaitlistLibrary(bench, activeIds, false) },
    ];
    const rankings = buildPowerRankings(
      analysis,
      waitlistSummaries,
      new Map(),
      "us"
    );

    assert.equal(rankings.length, 2);
    assert.equal(rankings[0].name, "Beta");
    assert.equal(rankings[0].role, "WAITLIST");
    assert.equal(rankings[0].tier, "S");
    assert.equal(rankings[0].sharePercent, null);
    assert.equal(rankings[1].name, "Alpha");
    assert.equal(rankings[1].role, "ACTIVE");
    assert.equal(rankings[1].sharePercent, 100);
  });
});
