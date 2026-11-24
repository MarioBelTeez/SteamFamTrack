"use client";

import { useState } from "react";
import { FamilyMemberInput } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";

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
  const [draftMembers, setDraftMembers] = useState<FamilyMemberInput[]>(members);
  const [draftWaitlist, setDraftWaitlist] = useState<FamilyMemberInput[]>(waitlist);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Edit Steam Family &amp; Waitlist
            </h2>
            <p className="text-xs text-slate-400">
              Steam Families allow up to 6 active members. Set join dates to track 1-year slot unlocks.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-6">
          {/* Active Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                Active Members ({draftMembers.length}/6)
              </span>
              {draftMembers.length < 6 && (
                <button
                  onClick={() => addMember(false)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Slot
                </button>
              )}
            </div>
            <div className="space-y-2">
              {draftMembers.map((m) => (
                <div
                  key={m.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-lg border border-slate-800 bg-slate-950/60 p-2.5"
                >
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) =>
                      updateItem(draftMembers, setDraftMembers, m.id, {
                        name: e.target.value,
                      })
                    }
                    placeholder="Display Name"
                    className="sm:col-span-3 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={m.steamUrlOrId}
                    onChange={(e) =>
                      updateItem(draftMembers, setDraftMembers, m.id, {
                        steamUrlOrId: e.target.value,
                      })
                    }
                    placeholder="Steam Profile URL or SteamID64"
                    className="sm:col-span-5 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="date"
                    value={m.joinDate ?? ""}
                    onChange={(e) =>
                      updateItem(draftMembers, setDraftMembers, m.id, {
                        joinDate: e.target.value,
                      })
                    }
                    className="sm:col-span-3 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={() =>
                      setDraftMembers(draftMembers.filter((x) => x.id !== m.id))
                    }
                    disabled={draftMembers.length <= 1}
                    className="sm:col-span-1 flex justify-center text-slate-500 hover:text-rose-400 disabled:opacity-30"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Waitlist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Waitlist ({draftWaitlist.length})
              </span>
              <button
                onClick={() => addMember(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
              >
                <Plus className="h-3.5 w-3.5" /> Add Waitlist
              </button>
            </div>
            <div className="space-y-2">
              {draftWaitlist.map((w) => (
                <div
                  key={w.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-lg border border-slate-800 bg-slate-950/60 p-2.5"
                >
                  <input
                    type="text"
                    value={w.name}
                    onChange={(e) =>
                      updateItem(draftWaitlist, setDraftWaitlist, w.id, {
                        name: e.target.value,
                      })
                    }
                    placeholder="Display Name"
                    className="sm:col-span-4 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={w.steamUrlOrId}
                    onChange={(e) =>
                      updateItem(draftWaitlist, setDraftWaitlist, w.id, {
                        steamUrlOrId: e.target.value,
                      })
                    }
                    placeholder="Steam Profile URL or SteamID64"
                    className="sm:col-span-7 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <button
                    onClick={() =>
                      setDraftWaitlist(draftWaitlist.filter((x) => x.id !== w.id))
                    }
                    className="sm:col-span-1 flex justify-center text-slate-500 hover:text-rose-400"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3.5 bg-slate-950/50">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(draftMembers, draftWaitlist);
              onClose();
            }}
            className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
          >
            Save &amp; Re-Analyze
          </button>
        </div>
      </div>
    </div>
  );
}
