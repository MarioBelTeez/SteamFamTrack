import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { parseGameQuery } = (await import(
  `./steam-check${".ts"}`
)) as typeof import("./steam-check");

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
