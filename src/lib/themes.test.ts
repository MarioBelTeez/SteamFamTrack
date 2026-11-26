import { describe, it } from "node:test";
import assert from "node:assert/strict";

const {
  APP_THEMES,
  DEFAULT_THEME_ID,
  buildThemeInitScript,
  getThemeById,
  isValidThemeId,
} = (await import(`./themes${".ts"}`)) as typeof import("./themes");

describe("themes registry", () => {
  it("contains unique dark and light palettes with valid hex and RGB tokens", () => {
    const ids = new Set(APP_THEMES.map((t) => t.id));
    assert.equal(ids.size, APP_THEMES.length);
    assert.ok(APP_THEMES.some((t) => t.mode === "dark"));
    assert.ok(APP_THEMES.some((t) => t.mode === "light"));

    for (const theme of APP_THEMES) {
      assert.match(theme.tokens.accent, /^#[0-9A-Fa-f]{6}$/);
      assert.match(theme.tokens.bg, /^#[0-9A-Fa-f]{6}$/);
      assert.match(theme.tokens.surface, /^#[0-9A-Fa-f]{6}$/);
      assert.match(theme.tokens.ink, /^#[0-9A-Fa-f]{6}$/);
      assert.match(theme.tokens.accentRgb, /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/);
    }
  });

  it("validates theme IDs and falls back safely to default", () => {
    assert.equal(isValidThemeId("steam-blue"), true);
    assert.equal(isValidThemeId("daylight-clean"), true);
    assert.equal(isValidThemeId("unknown-theme"), false);
    assert.equal(getThemeById("unknown-theme").id, DEFAULT_THEME_ID);
    assert.equal(getThemeById("catppuccin-latte").mode, "light");
  });

  it("generates a self-contained bootstrap script referencing every theme", () => {
    const script = buildThemeInitScript();
    for (const theme of APP_THEMES) {
      assert.ok(script.includes(theme.id), `missing ${theme.id} in init script`);
    }
  });
});
