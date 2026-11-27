"use client";

import { useState } from "react";
import { SteamSessionUser } from "@/components/MemberEditorModal";
import {
  FamilyAnalysis,
  FamilyMemberInput,
  SavedFamilyData,
  SteamRegion,
} from "@/lib/types";
import { CheckCircle2, Loader2, LogIn, Save, ShieldCheck, X } from "lucide-react";

interface SaveFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  region: SteamRegion;
  members: FamilyMemberInput[];
  waitlist: FamilyMemberInput[];
  analysis: FamilyAnalysis | null;
  steamUser?: SteamSessionUser | null;
  onSteamSignIn?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onSaved?: (family: SavedFamilyData) => void;
}

export function SaveFamilyModal({
  isOpen,
  onClose,
  region,
  members,
  waitlist,
  analysis,
  steamUser = null,
  onSteamSignIn,
  onSaved,
}: SaveFamilyModalProps) {
  const [name, setName] = useState("My Steam Family");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFamily, setSavedFamily] = useState<SavedFamilyData | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setSavedFamily(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!steamUser) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "My Steam Family",
          region,
          members,
          waitlist,
          initialAnalysis: analysis ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to save family group");
      }

      const createdFamily = (data.family ?? data) as SavedFamilyData;
      setSavedFamily(createdFamily);
      onSaved?.(createdFamily);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save family");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-family-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="p5-frame w-full max-w-md bg-bt-red/70 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
        <div className="bg-bt-surface overflow-hidden">
          <div className="h-[2px] w-full bg-bt-red" />

          {/* Modal Header */}
          <div className="flex items-center justify-between gap-3 border-b border-bt-border px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Save className="h-4 w-4 text-bt-red shrink-0" />
              <h2
                id="save-family-title"
                className="font-display text-2xl tracking-wider uppercase text-white leading-none"
              >
                {savedFamily
                  ? "Family Saved"
                  : steamUser
                    ? "Save Steam Family"
                    : "Sign in to Save"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close modal"
              className="cursor-pointer border border-bt-border bg-bt-elevated p-1.5 text-bt-muted hover:border-bt-red hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!steamUser ? (
            <div className="p-6 space-y-5">
              <div className="border-y border-r border-bt-red/35 border-l-4 border-l-bt-red bg-bt-red/10 px-4 py-3.5 text-xs text-bt-muted leading-relaxed">
                Sign in with your Steam account to save this family privately.
                Anyone in your 6 active slots or 6 waitlist slots will
                automatically see it when they sign in with Steam.
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-bt-border pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="cursor-pointer border border-bt-border px-4 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-bt-muted hover:border-white/40 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <a
                  href="/api/auth/steam"
                  onClick={onSteamSignIn}
                  className="p5-btn cursor-pointer inline-flex items-center gap-2 bg-bt-red px-5 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign in with Steam to Save</span>
                </a>
              </div>
            </div>
          ) : savedFamily ? (
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3 border-y border-r border-emerald-500/35 border-l-4 border-l-emerald-400 bg-emerald-500/10 px-4 py-3.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-condensed text-sm font-bold uppercase tracking-wider text-white">
                    Saved to your Steam account!
                  </div>
                  <p className="text-xs text-bt-muted leading-relaxed">
                    <span className="font-semibold text-white">
                      {savedFamily.name}
                    </span>{" "}
                    is now linked to{" "}
                    <span className="text-white">{steamUser.personaName}</span>{" "}
                    and all listed active &amp; waitlist Steam members.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-bt-border pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="p5-btn cursor-pointer inline-flex items-center gap-1.5 bg-bt-red px-5 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="family-group-name"
                  className="mb-1.5 block font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted"
                >
                  Family Name
                </label>
                <input
                  id="family-group-name"
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Steam Family"
                  className="w-full border border-bt-border bg-bt-bg px-3 py-2.5 font-mono text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                />
              </div>

              <div className="flex items-start gap-2.5 border border-bt-border border-l-2 border-l-bt-red bg-bt-elevated/80 px-3.5 py-3 text-xs text-bt-muted leading-relaxed">
                <ShieldCheck className="h-4 w-4 text-bt-red shrink-0 mt-0.5" />
                <span>
                  Saved privately to your Steam account ({steamUser.personaName}
                  ). Anyone in your 6 active slots or 6 waitlist slots
                  automatically sees this family when they sign in with Steam.
                </span>
              </div>

              {error && (
                <div className="border-y border-r border-bt-red/40 border-l-4 border-l-bt-red bg-bt-red/10 px-3.5 py-2.5 text-xs text-red-200">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-bt-border pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="cursor-pointer border border-bt-border px-4 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-bt-muted hover:border-white/40 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="p5-btn cursor-pointer inline-flex items-center gap-1.5 bg-bt-red px-5 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Family
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
