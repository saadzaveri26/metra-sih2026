"use client";

import { useState, useEffect } from "react";
import type { OfficerOverride } from "@/lib/api";
import { FIELD_LABELS } from "@/lib/fields";

export default function OfficerOverrideModal({
  isOpen,
  field,
  currentAiValue,
  currentOverride,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  field: string | null;
  currentAiValue: string | null;
  currentOverride?: OfficerOverride | null;
  onClose: () => void;
  onSave: (field: string, value: string, reason: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && field) {
      setValue(currentOverride?.value ?? currentAiValue ?? "");
      setReason(currentOverride?.reason ?? "");
      setError(null);
    }
  }, [isOpen, field, currentAiValue, currentOverride]);

  if (!isOpen || !field) return null;

  const fieldLabel = FIELD_LABELS[field] ?? field;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      setError("Please provide a valid corrected declaration value.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(field!, value.trim(), reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save officer override");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <h3 className="text-base font-bold text-on-surface">Officer Manual Override</h3>
            <p className="text-xs text-on-surface-variant">
              Field: <span className="font-semibold text-on-surface">{fieldLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container"
          >
            ✕
          </button>
        </div>

        {/* AI Integrity Notice */}
        <div className="mb-4 rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">
          <p className="font-semibold text-on-surface">Decision-Support Transparency</p>
          <p className="mt-0.5">
            The AI&apos;s original extraction will be permanently retained in the audit record alongside
            your override.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-medium text-on-surface">Original AI Read:</span>
            <span className="font-mono text-on-surface-variant">
              {currentAiValue ? `"${currentAiValue}"` : "Not detected"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface">
              Corrected / Verified Value <span className="text-violation">*</span>
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter correct ${fieldLabel}`}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary-container focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface">
              Reason for Override (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Visual verification, glare on packaging, distorted font"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:border-primary-container focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-md bg-violation-container px-3 py-2 text-xs text-violation">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Applying…" : "Apply Override & Re-Evaluate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
