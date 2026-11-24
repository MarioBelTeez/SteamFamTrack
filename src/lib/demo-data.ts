import { FamilyMemberInput, GameInfo, MemberLibrary, SteamRegion } from "./types";

interface DemoGameSeed {
  appid: number;
  name: string;
  menaUsd: number;
  usUsd: number;
  familySharingExcluded?: boolean;
  isFree?: boolean;
}

const DEMO_GAMES: Record<string, DemoGameSeed> = {
  eldenRing: { appid: 1245620, name: "ELDEN RING", menaUsd: 39.99, usUsd: 59.99 },
  ds3: { appid: 374320, name: "DARK SOULS™ III Deluxe", menaUsd: 54.99, usUsd: 84.99 },
  ds1: { appid: 570940, name: "DARK SOULS™: REMASTERED", menaUsd: 24.99, usUsd: 39.99 },
  ds2: { appid: 335300, name: "DARK SOULS™ II: Scholar of the First Sin", menaUsd: 24.99, usUsd: 39.99 },
  bg3: { appid: 1086940, name: "Baldur's Gate 3", menaUsd: 34.99, usUsd: 59.99 },
  cyberpunk: { appid: 1091500, name: "Cyberpunk 2077", menaUsd: 29.99, usUsd: 59.99 },
  sekiro: { appid: 814380, name: "Sekiro™: Shadows Die Twice", menaUsd: 29.99, usUsd: 59.99 },
  rdr2: { appid: 1174180, name: "Red Dead Redemption 2", menaUsd: 29.99, usUsd: 59.99 },
  hades2: { appid: 1145350, name: "Hades II", menaUsd: 14.99, usUsd: 29.99 },
  hollowKnight: { appid: 367520, name: "Hollow Knight", menaUsd: 7.99, usUsd: 14.99 },
  riskOfRain2: { appid: 632360, name: "Risk of Rain 2", menaUsd: 12.49, usUsd: 24.99 },
  terraria: { appid: 105600, name: "Terraria", menaUsd: 5.79, usUsd: 9.99 },
  stardew: { appid: 413150, name: "Stardew Valley", menaUsd: 7.99, usUsd: 14.99 },
  portal2: { appid: 620, name: "Portal 2", menaUsd: 5.79, usUsd: 9.99 },
  l4d2: { appid: 550, name: "Left 4 Dead 2", menaUsd: 5.79, usUsd: 9.99 },
  helldivers2: { appid: 553850, name: "HELLDIVERS™ 2", menaUsd: 24.99, usUsd: 39.99 },
  palworld: { appid: 1623730, name: "Palworld", menaUsd: 14.99, usUsd: 29.99 },
  lethalCompany: { appid: 1966720, name: "Lethal Company", menaUsd: 5.79, usUsd: 9.99 },
  witcher3: { appid: 292030, name: "The Witcher 3: Wild Hunt", menaUsd: 19.99, usUsd: 39.99 },
  godOfWar: { appid: 1593500, name: "God of War", menaUsd: 24.99, usUsd: 49.99 },
  ghostTsushima: { appid: 2215430, name: "Ghost of Tsushima DIRECTOR'S CUT", menaUsd: 39.99, usUsd: 59.99 },
  blackMyth: { appid: 2358720, name: "Black Myth: Wukong", menaUsd: 39.99, usUsd: 59.99 },
  celeste: { appid: 504230, name: "Celeste", menaUsd: 10.49, usUsd: 19.99 },
  outerWilds: { appid: 753640, name: "Outer Wilds", menaUsd: 12.49, usUsd: 24.99 },
  codHq: {
    appid: 1938090,
    name: "Call of Duty® (Excluded)",
    menaUsd: 69.99,
    usUsd: 69.99,
    familySharingExcluded: true,
  },
  eaFc: {
    appid: 2669320,
    name: "EA SPORTS FC™ 25 (Excluded)",
    menaUsd: 49.99,
    usUsd: 69.99,
    familySharingExcluded: true,
  },
  tellMeWhy: {
    appid: 1180660,
    name: "Tell Me Why",
    menaUsd: 0,
    usUsd: 0,
    isFree: true,
  },
};

function scalePrice(seed: DemoGameSeed, region: SteamRegion): number {
  if (seed.isFree) return 0;
  switch (region) {
    case "ma":
      return seed.menaUsd;
    case "us":
      return seed.usUsd;
    case "eu":
      return Math.round(seed.usUsd * 0.95 * 100) / 100;
    case "gb":
      return Math.round(seed.usUsd * 0.82 * 100) / 100;
    case "br":
      return Math.round(seed.menaUsd * 4.8 * 100) / 100;
    case "jp":
      return Math.round(seed.usUsd * 140);
  }
}

function toGameInfo(seed: DemoGameSeed, region: SteamRegion): GameInfo {
  return {
    appid: seed.appid,
    name: seed.name,
    rawPrice: scalePrice(seed, region),
    isFree: Boolean(seed.isFree),
    familySharingExcluded: Boolean(seed.familySharingExcluded),
    headerImage: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${seed.appid}/header.jpg`,
  };
}

export const DEMO_ACTIVE_INPUTS: FamilyMemberInput[] = [
  {
    id: "m1",
    name: "Mario",
    steamUrlOrId: "https://steamcommunity.com/id/mariobelteez",
    joinDate: "2025-09-12",
  },
  {
    id: "m2",
    name: "Adam",
    steamUrlOrId: "https://steamcommunity.com/id/adam_bel_khara",
    joinDate: "2025-09-12",
  },
  {
    id: "m3",
    name: "Smoky",
    steamUrlOrId: "https://steamcommunity.com/id/smoky",
    joinDate: "2026-01-18",
  },
  {
    id: "m4",
    name: "Ali",
    steamUrlOrId: "https://steamcommunity.com/id/hello33368",
    joinDate: "2026-03-04",
  },
  {
    id: "m5",
    name: "Rocker",
    steamUrlOrId: "https://steamcommunity.com/id/Rocker6600",
    joinDate: "2025-11-01",
  },
  {
    id: "m6",
    name: "Amo",
    steamUrlOrId: "https://steamcommunity.com/id/amo",
    joinDate: "2026-06-22",
  },
];

export const DEMO_WAITLIST_INPUTS: FamilyMemberInput[] = [
  {
    id: "w1",
    name: "Yassine",
    steamUrlOrId: "https://steamcommunity.com/id/yassine_gg",
    isWaitlist: true,
  },
  {
    id: "w2",
    name: "Karim",
    steamUrlOrId: "https://steamcommunity.com/id/karim_fps",
    isWaitlist: true,
  },
];

const DEMO_OWNERSHIP: Record<string, (keyof typeof DEMO_GAMES)[]> = {
  m1: [
    "eldenRing",
    "ds1",
    "ds2",
    "ds3",
    "sekiro",
    "bg3",
    "hollowKnight",
    "outerWilds",
    "celeste",
    "terraria",
    "portal2",
    "lethalCompany",
    "tellMeWhy",
    "codHq",
  ],
  m2: [
    "eldenRing",
    "cyberpunk",
    "rdr2",
    "witcher3",
    "godOfWar",
    "helldivers2",
    "riskOfRain2",
    "terraria",
    "l4d2",
    "eaFc",
  ],
  m3: [
    "blackMyth",
    "ghostTsushima",
    "sekiro",
    "hades2",
    "palworld",
    "riskOfRain2",
    "lethalCompany",
  ],
  m4: [
    "cyberpunk",
    "bg3",
    "helldivers2",
    "stardew",
    "terraria",
    "portal2",
    "l4d2",
    "hollowKnight",
  ],
  m5: ["rdr2", "witcher3", "palworld", "stardew", "lethalCompany", "l4d2"],
  m6: ["hades2", "celeste", "terraria", "portal2", "stardew"],
  w1: [
    "blackMyth",
    "ghostTsushima",
    "godOfWar",
    "eldenRing",
    "hades2",
    "outerWilds",
    "riskOfRain2",
  ],
  w2: ["helldivers2", "palworld", "l4d2", "terraria", "codHq"],
};

export function buildDemoLibraries(
  inputs: FamilyMemberInput[],
  region: SteamRegion
): MemberLibrary[] {
  return inputs.map((member, idx) => {
    const keys = DEMO_OWNERSHIP[member.id] ?? ["terraria", "portal2", "l4d2"];
    const games = keys.map((k) => toGameInfo(DEMO_GAMES[k], region));
    const excludedCount = games.filter((g) => g.familySharingExcluded).length;

    return {
      member,
      steamId64: `765611980000000${10 + idx}`,
      personaName: member.name,
      avatarUrl: "",
      profileUrl: member.steamUrlOrId,
      games,
      excludedCount,
    };
  });
}
