"use client";

import { useState } from "react";
import { FamilyMemberInput } from "@/lib/types";
import { Plus, Trash2, Users, X } from "lucide-react";

interface MemberEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMemberInput[];
  waitlist: FamilyMemberInput[];
  onSave: (members: FamilyMemberInput[], waitlist: FamilyMemberInput[]) => void;
}

export function MemberEditorModal({
  isOpen,
  onClose,
  members,
  waitlist,
  onSave,
}: MemberEditorModalProps) {
  const [draftMembers, setDraftMembers] =
    useState<FamilyMemberInput[]>(members);
  const [draftWaitlist, setDraftWaitlist] =
    useState<FamilyMemberInput[]>(waitlist);

  if (!isOpen) return null;

  const updateItem = (
    list: FamilyMemberInput[],
    setter: (v: FamilyMemberInput[]) => void,
    id: string,
    patch: Partial<FamilyMemberInput>
  ) => {
    setter(list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addMember = (isWait: boolean) => {
    const newItem: FamilyMemberInput = {
      id: `${isWait ? "w" : "m"}-${Date.now()}`,
      name: isWait ? "Waitlist Friend" : "New Member",
      steamUrlOrId: "",
      joinDate: isWait ? undefined : new Date().toISOString().slice(0, 10),
      isWaitlist: isWait,
    };
    if (isWait) {
      setDraftWaitlist([...draftWaitlist, newItem]);
    } else if (draftMembers.length < 6) {
      setDraftMembers([...draftMembers, newItem]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="p5-frame w-full max-w-2xl bg-bt-red/70 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
        <div className="bg-bt-surface overflow-hidden">
          <div className="h-[2px] w-full bg-bt-red" />

          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 border-b border-bt-border px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-bt-red/40 bg-bt-red/10 text-bt-red">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2
                  id="member-editor-title"
                  className="font-display text-2xl tracking-wider uppercase text-white leading-none"
                >
                  Edit Steam Family &amp; Waitlist
                </h2>
                <p className="mt-1 text-xs text-bt-muted">
                  Steam Families allow up to 6 active slots. Set join dates to
                  track 1-year slot cooldown unlocks.
                </p>
              </div>
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

          {/* Scrollable Body */}
          <div className="max-h-[65vh] overflow-y-auto p-6 space-y-6">
            {/* Active Members */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="tier-rail h-4 w-1 bg-bt-red" />
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-red">
                    Active Members ({draftMembers.length}/6)
                  </span>
                </div>
                {draftMembers.length < 6 && (
                  <button
                    type="button"
                    onClick={() => addMember(false)}
                    className="cursor-pointer inline-flex items-center gap-1 border border-bt-red/50 bg-bt-red/10 px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:bg-bt-red transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Slot
                  </button>
                )}
              </div>

              <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2.5 pb-1.5 font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                <span className="sm:col-span-3">Display Name</span>
                <span className="sm:col-span-5">Steam URL or SteamID64</span>
                <span className="sm:col-span-3">Join Date</span>
                <span className="sm:col-span-1 text-center">Del</span>
              </div>

              <div className="space-y-2">
                {draftMembers.map((m) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border border-bt-border bg-bt-elevated/80 p-2.5"
                  >
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) =>
                        updateItem(draftMembers, setDraftMembers, m.id, {
                          name: e.target.value,
                        })
                      }
                      aria-label="Member display name"
                      placeholder="Display Name"
                      className="sm:col-span-3 border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                    />
                    <input
                      type="text"
                      value={m.steamUrlOrId}
                      onChange={(e) =>
                        updateItem(draftMembers, setDraftMembers, m.id, {
                          steamUrlOrId: e.target.value,
                        })
                      }
                      aria-label="Member Steam Profile URL or SteamID64"
                      placeholder="Steam Profile URL or SteamID64"
                      className="sm:col-span-5 border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                    />
                    <input
                      type="date"
                      value={m.joinDate ?? ""}
                      onChange={(e) =>
                        updateItem(draftMembers, setDraftMembers, m.id, {
                          joinDate: e.target.value,
                        })
                      }
                      aria-label="Member join date"
                      className="sm:col-span-3 border border-bt-border bg-bt-bg px-2 py-1.5 font-mono text-sm text-white [color-scheme:dark] focus:border-bt-red focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraftMembers(
                          draftMembers.filter((x) => x.id !== m.id)
                        )
                      }
                      disabled={draftMembers.length <= 1}
                      className="sm:col-span-1 cursor-pointer flex items-center justify-center p-1.5 text-bt-muted hover:text-bt-red transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove member"
                      aria-label={`Remove ${m.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Waitlist */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="tier-rail h-4 w-1 bg-bt-muted" />
                  <span className="font-condensed text-xs font-bold uppercase tracking-[0.2em] text-bt-muted">
                    Waitlist Challengers ({draftWaitlist.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addMember(true)}
                  className="cursor-pointer inline-flex items-center gap-1 border border-bt-border bg-bt-elevated px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-wider text-white hover:border-bt-red transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Waitlist
                </button>
              </div>

              {draftWaitlist.length === 0 ? (
                <div className="border border-dashed border-bt-border bg-bt-bg/60 px-4 py-5 text-center text-xs text-bt-muted">
                  No waitlisted friends added. Click &ldquo;Add Waitlist&rdquo;
                  to stage challengers for the Swap Simulator.
                </div>
              ) : (
                <>
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2.5 pb-1.5 font-condensed text-[10px] font-bold uppercase tracking-widest text-bt-muted">
                    <span className="sm:col-span-4">Display Name</span>
                    <span className="sm:col-span-7">
                      Steam URL or SteamID64
                    </span>
                    <span className="sm:col-span-1 text-center">Del</span>
                  </div>

                  <div className="space-y-2">
                    {draftWaitlist.map((w) => (
                      <div
                        key={w.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center border border-bt-border bg-bt-elevated/80 p-2.5"
                      >
                        <input
                          type="text"
                          value={w.name}
                          onChange={(e) =>
                            updateItem(draftWaitlist, setDraftWaitlist, w.id, {
                              name: e.target.value,
                            })
                          }
                          aria-label="Waitlist member display name"
                          placeholder="Display Name"
                          className="sm:col-span-4 border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                        />
                        <input
                          type="text"
                          value={w.steamUrlOrId}
                          onChange={(e) =>
                            updateItem(draftWaitlist, setDraftWaitlist, w.id, {
                              steamUrlOrId: e.target.value,
                            })
                          }
                          aria-label="Waitlist member Steam Profile URL or SteamID64"
                          placeholder="Steam Profile URL or SteamID64"
                          className="sm:col-span-7 border border-bt-border bg-bt-bg px-2.5 py-1.5 font-mono text-sm text-white placeholder:text-bt-dim focus:border-bt-red focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraftWaitlist(
                              draftWaitlist.filter((x) => x.id !== w.id)
                            )
                          }
                          className="sm:col-span-1 cursor-pointer flex items-center justify-center p-1.5 text-bt-muted hover:text-bt-red transition-colors"
                          title="Remove waitlisted member"
                          aria-label={`Remove ${w.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-bt-border bg-bt-bg/90 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-bt-border px-4 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-bt-muted hover:border-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draftMembers, draftWaitlist);
                onClose();
              }}
              className="p5-btn cursor-pointer bg-bt-red px-5 py-2 font-condensed text-xs font-bold uppercase tracking-widest text-white hover:bg-bt-red-hover transition-colors"
            >
              Save &amp; Re-Analyze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
