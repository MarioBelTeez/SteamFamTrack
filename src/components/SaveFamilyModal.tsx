"use client";

import { useState } from "react";
import { FamilyAnalysis, FamilyMemberInput, SteamRegion } from "@/lib/types";
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Share2,
  X,
} from "lucide-react";

interface SaveFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  region: SteamRegion;
  members: FamilyMemberInput[];
  waitlist: FamilyMemberInput[];
  analysis: FamilyAnalysis | null;
}

interface CreatedResult {
  slug: string;
  name: string;
  editKey: string;
}

export function SaveFamilyModal({
  isOpen,
  onClose,
  region,
  members,
  waitlist,
  analysis,
}: SaveFamilyModalProps) {
  const [name, setName] = useState("My Steam Family");
  const [editKey, setEditKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedResult | null>(null);
  const [copiedField, setCopiedField] = useState<"url" | "key" | null>(null);

  if (!isOpen) return null;

  const shareUrl =
    created && typeof window !== "undefined"
      ? `${window.location.origin}/f/${created.slug}`
      : "";

  const copyText = (text: string, field: "url" | "key") => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          region,
          editKey: editKey.trim() || undefined,
          members,
          waitlist,
          initialAnalysis: analysis ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to save family group");
      }
      try {
        sessionStorage.setItem(`sft_edit_key:${data.slug}`, data.editKey);
      } catch {
        // ignore storage errors
      }
      setCreated({
        slug: data.slug,
        name: data.name,
        editKey: data.editKey,
      });
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
              <Share2 className="h-4 w-4 text-bt-red shrink-0" />
              <h2
                id="save-family-title"
                className="font-display text-2xl tracking-wider uppercase text-white leading-none"
              >
                {created ? "Family Group Saved" : "Save & Share Steam Family"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="cursor-pointer border border-bt-border bg-bt-elevated p-1.5 text-bt-muted hover:border-bt-red hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {created ? (
            <div className="p-6 space-y-5">
              <div className="border-y border-r border-emerald-500/30 border-l-4 border-l-emerald-400 bg-emerald-500/10 px-3.5 py-3 text-xs text-bt-muted">
                Anyone with the link below can view your board and run swap
                simulations. Store your{" "}
                <strong className="text-white">Edit Passcode</strong> safely —
                it is required to edit members or record monthly snapshots.
              </div>

              <div>
                <label
                  htmlFor="saved-share-url"
                  className="mb-1.5 block font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted"
                >
                  Shareable Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="saved-share-url"
                    readOnly
                    value={shareUrl}
                    className="flex-1 border border-bt-border bg-bt-bg px-3 py-2 font-mono text-sm text-white focus:border-bt-red focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(shareUrl, "url")}
                    aria-label="Copy shareable link"
                    className="cursor-pointer border border-bt-border bg-bt-elevated px-3 py-2.5 text-white hover:border-bt-red transition-colors"
                  >
                    {copiedField === "url" ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="saved-edit-key"
                  className="mb-1.5 block font-condensed text-xs font-bold uppercase tracking-wider text-amber-300"
                >
                  Edit Passcode (Shown Once)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="saved-edit-key"
                    readOnly
                    value={created.editKey}
                    className="flex-1 border border-amber-500/45 bg-amber-500/10 px-3 py-2 font-mono text-sm font-bold text-amber-200 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(created.editKey, "key")}
                    aria-label="Copy edit passcode"
                    className="cursor-pointer border border-bt-border bg-bt-elevated px-3 py-2.5 text-white hover:border-bt-red transition-colors"
                  >
                    {copiedField === "key" ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-bt-border pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer border border-bt-border px-4 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-bt-muted hover:border-white/40 hover:text-white transition-colors"
                >
                  Close
                </button>
                <a
                  href={`/f/${created.slug}`}
                  className="p5-btn cursor-pointer inline-flex items-center gap-1.5 bg-bt-red px-5 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors"
                >
                  Open Group Page
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <p className="text-xs text-bt-muted">
                Creates a permanent shareable URL (
                <span className="font-mono text-white">/f/your-group</span>)
                backed by Supabase with monthly snapshot tracking.
              </p>

              <div>
                <label
                  htmlFor="family-group-name"
                  className="mb-1.5 block font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted"
                >
                  Family Group Name
                </label>
                <input
                  id="family-group-name"
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Squad Steam Family"
                  className="w-full border border-bt-border bg-bt-bg px-3 py-2.5 font-mono text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="family-edit-key"
                  className="mb-1.5 flex items-center gap-1.5 font-condensed text-xs font-bold uppercase tracking-wider text-bt-muted"
                >
                  <KeyRound className="h-3.5 w-3.5 text-bt-red" />
                  Edit Passcode (optional — auto-generated if blank)
                </label>
                <input
                  id="family-edit-key"
                  type="text"
                  minLength={4}
                  maxLength={32}
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="w-full border border-bt-border bg-bt-bg px-3 py-2.5 font-mono text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                />
              </div>

              {error && (
                <div className="border-y border-r border-bt-red/40 border-l-4 border-l-bt-red bg-bt-red/10 px-3.5 py-2.5 text-xs text-red-200">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-bt-border pt-4">
                <button
                  type="button"
                  onClick={onClose}
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
                  Save &amp; Create Link
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
