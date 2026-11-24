"use client";

import { useState } from "react";
import { FamilyAnalysis, FamilyMemberInput, SteamRegion } from "@/lib/types";
import { Check, Copy, ExternalLink, KeyRound, Loader2, Share2, X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-sky-400" />
            <h2 className="text-base font-semibold text-white">
              {created ? "Family Group Saved" : "Save & Share Steam Family"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {created ? (
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-300">
              Anyone with the link below can view your board and run swap simulations. Keep your <strong className="text-white">Edit Passcode</strong> safe — it&apos;s required to edit members or record monthly snapshots.
            </p>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Shareable Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-sky-300"
                />
                <button
                  onClick={() => copyText(shareUrl, "url")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-700"
                >
                  {copiedField === "url" ? (
                    <Check className="h-4 w-4 text-lime-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-amber-300 mb-1">
                Edit Passcode (Shown Once)
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={created.editKey}
                  className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-mono font-bold text-amber-200"
                />
                <button
                  onClick={() => copyText(created.editKey, "key")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-700"
                >
                  {copiedField === "key" ? (
                    <Check className="h-4 w-4 text-lime-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              <a
                href={`/f/${created.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
              >
                Open Group Page
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-xs text-slate-400">
              Creates a permanent shareable URL (<span className="font-mono text-slate-300">/f/your-group</span>) backed by Supabase with monthly snapshot tracking.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Family Group Name
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Squad Steam Family"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                Edit Passcode (optional — auto-generated if blank)
              </label>
              <input
                type="text"
                minLength={4}
                maxLength={32}
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save &amp; Create Link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
