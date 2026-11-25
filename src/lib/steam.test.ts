import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FamilyMemberInput } from "./types";

const {
  parseSteamIdentifier,
  parseStoreBrowseItem,
  fetchMemberLibrariesLive,
} = (await import(`./steam${".ts"}`)) as typeof import("./steam");

describe("parseSteamIdentifier", () => {
  it("parses full /profiles/<17digits> URLs", () => {
    assert.deepEqual(
      parseSteamIdentifier(
        "https://steamcommunity.com/profiles/76561198012345678"
      ),
      { type: "steamid64", value: "76561198012345678" }
    );
  });

  it("parses /id/<vanity> URLs", () => {
    assert.deepEqual(
      parseSteamIdentifier("https://steamcommunity.com/id/gabelogannewell"),
      { type: "vanity", value: "gabelogannewell" }
    );
  });

  it("parses raw 17-digit SteamID64", () => {
    assert.deepEqual(parseSteamIdentifier("76561198012345678"), {
      type: "steamid64",
      value: "76561198012345678",
    });
  });

  it("parses raw vanity names", () => {
    assert.deepEqual(parseSteamIdentifier("  rayan_teez  "), {
      type: "vanity",
      value: "rayan_teez",
    });
  });

  it("handles trailing slashes on both profile and vanity URLs", () => {
    assert.deepEqual(
      parseSteamIdentifier(
        "https://steamcommunity.com/profiles/76561198012345678///"
      ),
      { type: "steamid64", value: "76561198012345678" }
    );

    assert.deepEqual(
      parseSteamIdentifier("https://steamcommunity.com/id/my_vanity/"),
      { type: "vanity", value: "my_vanity" }
    );
  });
});

describe("parseStoreBrowseItem", () => {
  it("marks paid game with category 62 as shareable", () => {
    const parsed = parseStoreBrowseItem({
      appid: 1245620,
      is_free: false,
      best_purchase_option: {
        final_price_in_cents: "5999",
      },
      categories: {
        feature_categoryids: [22, 62],
        supported_player_categoryids: [2],
      },
    });

    assert.deepEqual(parsed, {
      rawPrice: 59.99,
      isFree: false,
      familySharingExcluded: false,
    });
  });

  it("uses original_price_in_cents instead of discounted final_price_in_cents", () => {
    const parsed = parseStoreBrowseItem({
      appid: 1091500,
      is_free: false,
      best_purchase_option: {
        original_price_in_cents: "5999",
        final_price_in_cents: "2999",
      },
      categories: {
        feature_categoryids: [62],
      },
    });

    assert.deepEqual(parsed, {
      rawPrice: 59.99,
      isFree: false,
      familySharingExcluded: false,
    });
  });

  it("marks paid game missing category 62 as familySharingExcluded", () => {
    const parsed = parseStoreBrowseItem({
      appid: 271590,
      is_free: false,
      best_purchase_option: {
        original_price_in_cents: 2999,
        final_price_in_cents: 1499,
      },
      categories: {
        feature_categoryids: [22, 35],
        supported_player_categoryids: [1, 2],
        controller_categoryids: [28],
      },
    });

    assert.deepEqual(parsed, {
      rawPrice: 29.99,
      isFree: false,
      familySharingExcluded: true,
    });
  });

  it("returns rawPrice 0, isFree true, familySharingExcluded false for free games", () => {
    const parsed = parseStoreBrowseItem({
      appid: 730,
      is_free: true,
      best_purchase_option: {
        original_price_in_cents: "1499",
        final_price_in_cents: "1499",
      },
      categories: {
        feature_categoryids: [1, 35],
      },
    });

    assert.deepEqual(parsed, {
      rawPrice: 0,
      isFree: true,
      familySharingExcluded: false,
    });
  });

  it("checks all three category arrays for category 62", () => {
    const parsed = parseStoreBrowseItem({
      appid: 500,
      is_free: false,
      best_purchase_option: { final_price_in_cents: 1999 },
      categories: {
        supported_player_categoryids: [62],
      },
    });

    assert.equal(parsed.familySharingExcluded, false);
    assert.equal(parsed.rawPrice, 19.99);
  });
});

describe("fetchMemberLibrariesLive", () => {
  it("loads healthy members, reports private/failing members as warnings, and batches GetItems with region mapping", async () => {
    const originalFetch = globalThis.fetch;
    let capturedCountryCode: string | null = null;
    let browseCallCount = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("GetPlayerSummaries")) {
        return new Response(
          JSON.stringify({
            response: {
              players: [
                {
                  personaname: "AliceSteam",
                  avatarfull: "https://cdn.example/alice.jpg",
                  profileurl:
                    "https://steamcommunity.com/profiles/76561198000000001/",
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("GetOwnedGames")) {
        if (url.includes("76561198000000002")) {
          // Simulates private game details (no games array)
          return new Response(JSON.stringify({ response: {} }), {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({
            response: {
              games: [
                { appid: 900001, name: "Shareable RPG" },
                { appid: 900002, name: "Excluded Shooter" },
              ],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("IStoreBrowseService/GetItems/v1")) {
        browseCallCount += 1;
        const parsedUrl = new URL(url);
        const payload = JSON.parse(
          parsedUrl.searchParams.get("input_json") ?? "{}"
        );
        capturedCountryCode = payload?.context?.country_code ?? null;

        return new Response(
          JSON.stringify({
            response: {
              store_items: [
                {
                  appid: 900001,
                  success: 1,
                  is_free: false,
                  best_purchase_option: {
                    original_price_in_cents: "4999",
                    final_price_in_cents: "2499",
                  },
                  categories: { feature_categoryids: [62] },
                },
                {
                  appid: 900002,
                  success: 1,
                  is_free: false,
                  best_purchase_option: {
                    final_price_in_cents: "2999",
                  },
                  categories: { feature_categoryids: [22] },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const members: FamilyMemberInput[] = [
        {
          id: "m1",
          name: "Alice",
          steamUrlOrId: "76561198000000001",
        },
        {
          id: "m2",
          name: "PrivateBob",
          steamUrlOrId: "76561198000000002",
        },
      ];

      const { libraries, warnings } = await fetchMemberLibrariesLive(
        members,
        "eu",
        "fake-api-key"
      );

      assert.equal(browseCallCount, 1);
      assert.equal(capturedCountryCode, "DE");

      assert.equal(libraries.length, 1);
      assert.equal(libraries[0].member.id, "m1");
      assert.equal(libraries[0].personaName, "AliceSteam");
      assert.equal(libraries[0].excludedCount, 1);
      assert.equal(libraries[0].games[0].rawPrice, 49.99);
      assert.equal(libraries[0].games[0].familySharingExcluded, false);
      assert.equal(libraries[0].games[1].rawPrice, 29.99);
      assert.equal(libraries[0].games[1].familySharingExcluded, true);

      assert.equal(warnings.length, 1);
      assert.equal(warnings[0].memberId, "m2");
      assert.equal(warnings[0].memberName, "PrivateBob");
      assert.equal(warnings[0].steamInput, "76561198000000002");
      assert.match(warnings[0].reason, /Game details/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to appdetails when GetItems fails", async () => {
    const originalFetch = globalThis.fetch;
    let fallbackHit = false;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("GetPlayerSummaries")) {
        return new Response(
          JSON.stringify({
            response: { players: [{ personaname: "Charlie" }] },
          }),
          { status: 200 }
        );
      }

      if (url.includes("GetOwnedGames")) {
        return new Response(
          JSON.stringify({
            response: {
              games: [{ appid: 900099, name: "Fallback Indie" }],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("IStoreBrowseService/GetItems/v1")) {
        return new Response("Service Unavailable", { status: 503 });
      }

      if (url.includes("store.steampowered.com/api/appdetails")) {
        fallbackHit = true;
        return new Response(
          JSON.stringify({
            "900099": {
              success: true,
              data: {
                is_free: false,
                price_overview: { initial: 1999 },
                categories: [{ id: 62 }],
              },
            },
          }),
          { status: 200 }
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const { libraries, warnings } = await fetchMemberLibrariesLive(
        [
          {
            id: "m3",
            name: "Charlie",
            steamUrlOrId: "76561198000000003",
          },
        ],
        "us",
        "fake-api-key"
      );

      assert.equal(fallbackHit, true);
      assert.equal(warnings.length, 0);
      assert.equal(libraries.length, 1);
      assert.equal(libraries[0].games[0].rawPrice, 19.99);
      assert.equal(libraries[0].games[0].familySharingExcluded, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
