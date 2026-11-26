export type ThemeId =
  | "belteez-crimson"
  | "steam-blue"
  | "midnight-blurple"
  | "catppuccin-mocha"
  | "clean-dark"
  | "nord-frost"
  | "daylight-clean"
  | "catppuccin-latte";

export type ThemeMode = "dark" | "light";

export interface AppTheme {
  id: ThemeId;
  name: string;
  tagline: string;
  inspiredBy: string;
  mode: ThemeMode;
  onAccent: "light" | "dark";
  tokens: {
    accent: string;
    accentHover: string;
    accentRgb: string;
    onAccent: string;
    bg: string;
    surface: string;
    elevated: string;
    border: string;
    muted: string;
    dim: string;
    ink: string;
  };
}

export const THEME_STORAGE_KEY = "sft_theme_v1";
export const DEFAULT_THEME_ID: ThemeId = "belteez-crimson";

export const APP_THEMES: readonly AppTheme[] = [
  {
    id: "steam-blue",
    name: "Steam Deck Blue",
    tagline: "Native Steam Big Picture navy & electric sky blue",
    inspiredBy: "SteamOS / Big Picture",
    mode: "dark",
    onAccent: "light",
    tokens: {
      accent: "#1A9FFF",
      accentHover: "#47B5FF",
      accentRgb: "26 159 255",
      onAccent: "#FFFFFF",
      bg: "#0D131A",
      surface: "#151F2B",
      elevated: "#1C2A3B",
      border: "#2A3E54",
      muted: "#93A7BC",
      dim: "#62778D",
      ink: "#F3F8FC",
    },
  },
  {
    id: "midnight-blurple",
    name: "Midnight Blurple",
    tagline: "Cozy gaming-group indigo with crisp blurple highlights",
    inspiredBy: "Discord / Linear Dark",
    mode: "dark",
    onAccent: "light",
    tokens: {
      accent: "#7C6BFF",
      accentHover: "#9485FF",
      accentRgb: "124 107 255",
      onAccent: "#FFFFFF",
      bg: "#0C0D14",
      surface: "#131521",
      elevated: "#1B1E30",
      border: "#2C314A",
      muted: "#9AA0BC",
      dim: "#666C8A",
      ink: "#F5F6FC",
    },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Violet",
    tagline: "Soothing dark crust with pastel mauve-violet accents",
    inspiredBy: "Catppuccin Mocha",
    mode: "dark",
    onAccent: "dark",
    tokens: {
      accent: "#CBA6F7",
      accentHover: "#DEC2FF",
      accentRgb: "203 166 247",
      onAccent: "#11111B",
      bg: "#11111B",
      surface: "#181825",
      elevated: "#1E1E2E",
      border: "#313244",
      muted: "#A6ADC8",
      dim: "#6C7086",
      ink: "#CDD6F4",
    },
  },
  {
    id: "clean-dark",
    name: "Obsidian Dark",
    tagline: "Zero-tint neutral carbon dark mode with electric cyan",
    inspiredBy: "Vercel / Raycast Dark",
    mode: "dark",
    onAccent: "dark",
    tokens: {
      accent: "#38BDF8",
      accentHover: "#7DD3FC",
      accentRgb: "56 189 248",
      onAccent: "#07131A",
      bg: "#09090B",
      surface: "#111114",
      elevated: "#18181D",
      border: "#27272F",
      muted: "#A1A1AA",
      dim: "#71717A",
      ink: "#FAFAFA",
    },
  },
  {
    id: "nord-frost",
    name: "Nord Frost",
    tagline: "Low-strain arctic slate paired with glacier frost blue",
    inspiredBy: "Nord / Monkeytype",
    mode: "dark",
    onAccent: "dark",
    tokens: {
      accent: "#88C0D0",
      accentHover: "#A3D4E2",
      accentRgb: "136 192 208",
      onAccent: "#161B22",
      bg: "#1C212B",
      surface: "#242A36",
      elevated: "#2E3440",
      border: "#3E4759",
      muted: "#A6B2C5",
      dim: "#728098",
      ink: "#ECEFF4",
    },
  },
  {
    id: "belteez-crimson",
    name: "BelTeez Crimson",
    tagline: "Original Persona 5 / BelTeez Studio signature red & obsidian",
    inspiredBy: "BelTeez Studio",
    mode: "dark",
    onAccent: "light",
    tokens: {
      accent: "#E8002D",
      accentHover: "#FF1A45",
      accentRgb: "232 0 45",
      onAccent: "#FFFFFF",
      bg: "#08060A",
      surface: "#110C0F",
      elevated: "#181116",
      border: "#2A1F24",
      muted: "#9E8D94",
      dim: "#6B5B62",
      ink: "#FFFFFF",
    },
  },
  {
    id: "daylight-clean",
    name: "Daylight Light",
    tagline: "Crisp high-contrast light mode with cobalt blue accents",
    inspiredBy: "Linear / GitHub Light",
    mode: "light",
    onAccent: "light",
    tokens: {
      accent: "#2563EB",
      accentHover: "#1D4ED8",
      accentRgb: "37 99 235",
      onAccent: "#FFFFFF",
      bg: "#F3F5F9",
      surface: "#FFFFFF",
      elevated: "#EAEFF6",
      border: "#CBD5E1",
      muted: "#475569",
      dim: "#64748B",
      ink: "#0F172A",
    },
  },
  {
    id: "catppuccin-latte",
    name: "Lavender Paper",
    tagline: "Warm daylight paper with royal purple highlights",
    inspiredBy: "Catppuccin Latte",
    mode: "light",
    onAccent: "light",
    tokens: {
      accent: "#7C3AED",
      accentHover: "#6D28D9",
      accentRgb: "124 58 237",
      onAccent: "#FFFFFF",
      bg: "#EFF1F6",
      surface: "#FFFFFF",
      elevated: "#E6E9F2",
      border: "#C9CFE0",
      muted: "#4F546D",
      dim: "#6E738D",
      ink: "#1E2030",
    },
  },
] as const;

export function isValidThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    APP_THEMES.some((theme) => theme.id === value)
  );
}

export function getThemeById(id: string | null | undefined): AppTheme {
  return (
    APP_THEMES.find((theme) => theme.id === id) ??
    APP_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!
  );
}

export function applyThemeToDocument(id: ThemeId): AppTheme {
  const theme = getThemeById(id);
  if (typeof document === "undefined") return theme;

  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
  root.dataset.themeOnAccent = theme.onAccent;
  root.classList.toggle("dark", theme.mode === "dark");
  root.classList.toggle("light", theme.mode === "light");
  root.style.colorScheme = theme.mode;

  return theme;
}

export function readStoredThemeId(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidThemeId(raw) ? raw : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function saveStoredThemeId(id: ThemeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Ignore privacy mode / storage quota errors
  }
}

/**
 * Tiny synchronous bootstrap script run in <head> before hydration
 * to avoid any flash of the default theme when a saved theme exists.
 */
export function buildThemeInitScript(): string {
  const themeMap = Object.fromEntries(
    APP_THEMES.map((t) => [t.id, { mode: t.mode, onAccent: t.onAccent }])
  );
  return `(function(){try{var k=${JSON.stringify(
    THEME_STORAGE_KEY
  )};var m=${JSON.stringify(
    themeMap
  )};var id=localStorage.getItem(k);var t=id&&m[id]?id:${JSON.stringify(
    DEFAULT_THEME_ID
  )};var cfg=m[t];var r=document.documentElement;r.dataset.theme=t;r.dataset.themeMode=cfg.mode;r.dataset.themeOnAccent=cfg.onAccent;r.classList.toggle('dark',cfg.mode==='dark');r.classList.toggle('light',cfg.mode==='light');r.style.colorScheme=cfg.mode;}catch(e){}})();`;
}
