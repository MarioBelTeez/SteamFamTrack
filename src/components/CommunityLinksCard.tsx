"use client";

import { ArrowUpRight, Globe } from "lucide-react";

function safeHttpsUrl(value: string | undefined, fallback = ""): string {
  const trimmed = value?.trim() || "";
  if (trimmed.startsWith("https://")) return trimmed;
  return fallback;
}

const DISCORD_BOT_INSTALL_URL =
  "https://discord.com/oauth2/authorize?client_id=1575252351776989296";
const GITHUB_REPO_URL = "https://github.com/MarioBelTeez/SteamFamTrack";
const DISCORD_SERVER_URL = safeHttpsUrl(
  process.env.NEXT_PUBLIC_DISCORD_SERVER_URL,
  "https://discord.gg/3FBZdMJe8m"
);
const STEAM_GROUP_URL = safeHttpsUrl(
  process.env.NEXT_PUBLIC_STEAM_GROUP_URL,
  "https://steamcommunity.com/groups/belteezstudio"
);
const BELTEEZ_STUDIO_URL = safeHttpsUrl(
  process.env.NEXT_PUBLIC_BELTEEZ_STUDIO_URL,
  "https://belteez.studio"
);

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.11 13.11 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .5C5.648.5.5 5.648.5 12c0 5.084 3.292 9.397 7.865 10.918.575.106.785-.25.785-.556 0-.274-.01-1-.015-1.962-3.199.695-3.874-1.542-3.874-1.542-.523-1.328-1.277-1.682-1.277-1.682-1.044-.714.079-.7.079-.7 1.154.081 1.762 1.185 1.762 1.185 1.026 1.758 2.691 1.25 3.347.956.104-.743.402-1.25.731-1.538-2.554-.29-5.239-1.277-5.239-5.685 0-1.256.449-2.282 1.185-3.087-.119-.291-.513-1.462.112-3.047 0 0 .966-.309 3.164 1.179a11.02 11.02 0 0 1 2.88-.387c.977.004 1.962.132 2.881.387 2.196-1.488 3.161-1.179 3.161-1.179.627 1.585.233 2.756.114 3.047.737.805 1.183 1.831 1.183 3.087 0 4.419-2.689 5.392-5.252 5.676.413.356.781 1.058.781 2.133 0 1.54-.014 2.782-.014 3.16 0 .308.208.668.791.555C20.212 21.393 23.5 17.082 23.5 12 23.5 5.648 18.352.5 12 .5z" />
    </svg>
  );
}

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

export function CommunityLinksCard() {
  return (
    <div className="bg-bt-surface border border-bt-border p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-bt-border/80">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bt-muted">
          BELTEEZ // LINKS
        </span>
        <span className="font-mono text-[10px] text-bt-red">COMMUNITY</span>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <a
          href={DISCORD_BOT_INSTALL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-2 bg-bt-bg/75 hover:bg-bt-elevated border border-bt-border/80 hover:border-bt-red/70 px-2.5 py-2 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <DiscordIcon className="h-3.5 w-3.5 text-[#5865F2] shrink-0" />
            <span className="font-condensed text-xs font-bold uppercase tracking-wider text-white truncate">
              Add SteamFT Discord Bot
            </span>
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 text-bt-dim group-hover:text-bt-red transition-colors shrink-0" />
        </a>

        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-2 bg-bt-bg/75 hover:bg-bt-elevated border border-bt-border/80 hover:border-bt-red/70 px-2.5 py-2 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <GitHubIcon className="h-3.5 w-3.5 text-white shrink-0" />
            <span className="font-condensed text-xs font-bold uppercase tracking-wider text-white truncate">
              GitHub Source &amp; Issues
            </span>
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 text-bt-dim group-hover:text-bt-red transition-colors shrink-0" />
        </a>

        {DISCORD_SERVER_URL ? (
          <a
            href={DISCORD_SERVER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-2 bg-bt-bg/75 hover:bg-bt-elevated border border-bt-border/80 hover:border-bt-red/70 px-2.5 py-2 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <DiscordIcon className="h-3.5 w-3.5 text-bt-red shrink-0" />
              <span className="font-condensed text-xs font-bold uppercase tracking-wider text-white truncate">
                BelTeez Studio Discord
              </span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-bt-dim group-hover:text-bt-red transition-colors shrink-0" />
          </a>
        ) : (
          <div className="flex items-center justify-between gap-2 bg-bt-bg/40 border border-dashed border-bt-border/70 px-2.5 py-2">
            <span className="flex items-center gap-2 min-w-0">
              <DiscordIcon className="h-3.5 w-3.5 text-bt-dim shrink-0" />
              <span className="font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted truncate">
                BelTeez Studio Server
              </span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-bt-dim shrink-0">
              SOON
            </span>
          </div>
        )}

        {STEAM_GROUP_URL ? (
          <a
            href={STEAM_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-2 bg-bt-bg/75 hover:bg-bt-elevated border border-bt-border/80 hover:border-bt-red/70 px-2.5 py-2 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <SteamIcon className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span className="font-condensed text-xs font-bold uppercase tracking-wider text-white truncate">
                Steam Community Group
              </span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-bt-dim group-hover:text-bt-red transition-colors shrink-0" />
          </a>
        ) : (
          <div className="flex items-center justify-between gap-2 bg-bt-bg/40 border border-dashed border-bt-border/70 px-2.5 py-2">
            <span className="flex items-center gap-2 min-w-0">
              <SteamIcon className="h-3.5 w-3.5 text-bt-dim shrink-0" />
              <span className="font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted truncate">
                BelTeez Steam Group
              </span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-bt-dim shrink-0">
              SOON
            </span>
          </div>
        )}

        <a
          href={BELTEEZ_STUDIO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-2 bg-bt-bg/75 hover:bg-bt-elevated border border-bt-border/80 hover:border-bt-red/70 px-2.5 py-2 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Globe className="h-3.5 w-3.5 text-bt-red shrink-0" />
            <span className="font-condensed text-xs font-bold uppercase tracking-wider text-white truncate">
              BelTeez Studio
            </span>
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 text-bt-dim group-hover:text-bt-red transition-colors shrink-0" />
        </a>
      </div>
    </div>
  );
}
