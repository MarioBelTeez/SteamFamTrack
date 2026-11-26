import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const {
  clearSteamCheckCaches,
  getFamilyWishlists,
  getPopularSteamDiscounts,
  parseGameQuery,
} = (await import(`./steam-check${".ts"}`)) as typeof import("./steam-check");

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearSteamCheckCaches();
});

describe("parseGameQuery", () => {
  it("extracts AppID from Steam Store URLs", () => {
    assert.deepEqual(
      parseGameQuery("https://store.steampowered.com/app/1245620/ELDEN_RING/"),
      { type: "appid", appid: 1245620 }
    );
  });

  it("parses raw numeric AppIDs", () => {
    assert.deepEqual(parseGameQuery("  1086940 "), {
      type: "appid",
      appid: 1086940,
    });
  });

  it("falls back to store search for game titles", () => {
    assert.deepEqual(parseGameQuery("Hollow Knight"), {
      type: "search",
      term: "Hollow Knight",
    });
  });
});

describe("getPopularSteamDiscounts", () => {
  it("deduplicates appids, drops delisted/non-discounted items, and caches non-empty results", async () => {
    let browseCalls = 0;

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/search/results/")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                name: "Elden Ring",
                logo: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/capsule.jpg",
              },
              {
                name: "Elden Ring Duplicate",
                logo: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/capsule_2.jpg",
              },
              {
                name: "Delisted App",
                logo: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/999999/capsule.jpg",
              },
              {
                name: "Full Price App",
                logo: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/555555/capsule.jpg",
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.includes("IStoreBrowseService/GetItems")) {
        browseCalls += 1;
        return new Response(
          JSON.stringify({
            response: {
              store_items: [
                {
                  appid: 1245620,
                  success: 1,
                  name: "ELDEN RING",
                  is_free: false,
                  best_purchase_option: {
                    discount_pct: 40,
                    formatted_original_price: "$59.99",
                    formatted_final_price: "$35.99",
                    final_price_in_cents: "3599",
                  },
                  categories: { feature_categoryids: [62] },
                },
                {
                  appid: 999999,
                  success: 2,
                  name: "Delisted",
                },
                {
                  appid: 555555,
                  success: 1,
                  name: "Full Price Game",
                  is_free: false,
                  best_purchase_option: {
                    discount_pct: 0,
                    formatted_final_price: "$19.99",
                    final_price_in_cents: "1999",
                  },
                  categories: { feature_categoryids: [62] },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    const first = await getPopularSteamDiscounts("us");
    assert.equal(first.length, 1);
    assert.equal(first[0].appid, 1245620);
    assert.equal(first[0].discountPercent, 40);
    assert.equal(first[0].familySharingSupported, true);

    // Second call hits cache
    const second = await getPopularSteamDiscounts("us");
    assert.equal(second.length, 1);
    assert.equal(browseCalls, 1);
  });

  it("does not cache empty results after transient upstream failure", async () => {
    let searchCalls = 0;
    globalThis.fetch = (async () => {
      searchCalls += 1;
      return new Response("upstream error", { status: 503 });
    }) as typeof fetch;

    const first = await getPopularSteamDiscounts("eu");
    assert.deepEqual(first, []);
    const second = await getPopularSteamDiscounts("eu");
    assert.deepEqual(second, []);
    assert.ok(searchCalls >= 4, "expected retry instead of caching empty result");
  });
});

describe("getFamilyWishlists", () => {
  it("merges shared wishlists by overlap & priority, reports private members, and caches per steamId64", async () => {
    let wishlistFetches = 0;

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes("IWishlistService/GetWishlist")) {
        wishlistFetches += 1;
        if (url.includes("76561198000000001")) {
          return new Response(
            JSON.stringify({
              response: {
                items: [
                  { appid: 100, priority: 2 },
                  { appid: 200, priority: 1 },
                ],
              },
            }),
            { status: 200 }
          );
        }
        if (url.includes("76561198000000002")) {
          return new Response(
            JSON.stringify({
              response: {
                items: [{ appid: 100, priority: 5 }],
              },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ response: {} }), { status: 200 });
      }

      if (url.includes("IStoreBrowseService/GetItems")) {
        return new Response(
          JSON.stringify({
            response: {
              store_items: [
                {
                  appid: 100,
                  success: 1,
                  name: "Shared Wish",
                  is_free: false,
                  best_purchase_option: {
                    discount_pct: 50,
                    formatted_original_price: "$40.00",
                    formatted_final_price: "$20.00",
                    final_price_in_cents: "2000",
                  },
                  categories: { feature_categoryids: [62] },
                },
                {
                  appid: 200,
                  success: 1,
                  name: "Solo Wish",
                  is_free: false,
                  best_purchase_option: {
                    discount_pct: 0,
                    formatted_final_price: "$10.00",
                    final_price_in_cents: "1000",
                  },
                  categories: { feature_categoryids: [62] },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    const members = [
      { memberId: "1", name: "Alice", steamId64: "76561198000000001" },
      { memberId: "2", name: "Bob", steamId64: "76561198000000002" },
      { memberId: "3", name: "Charlie", steamId64: "76561198000000003" },
    ];

    const res = await getFamilyWishlists({ members, region: "us" });
    assert.deepEqual(res.privateMembers, ["Charlie"]);
    assert.equal(res.items.length, 2);
    assert.equal(res.items[0].appid, 100);
    assert.equal(res.items[0].wishCount, 2);
    assert.equal(res.items[1].appid, 200);
    assert.equal(res.items[1].wishCount, 1);

    // Second call should reuse memberWishlistCache (no extra IWishlistService calls)
    await getFamilyWishlists({ members, region: "us" });
    assert.equal(wishlistFetches, 3);
  });
});
