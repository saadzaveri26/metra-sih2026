"use client";

import { useEffect, useState } from "react";
import {
  compareScanListing,
  fetchMockListings,
  type MockListing,
  type MismatchComparisonResult,
  ApiError,
} from "@/lib/api";

const FIELD_LABELS: Record<string, string> = {
  manufacturer: "Manufacturer / Packer",
  net_quantity: "Net Quantity",
  mrp: "Maximum Retail Price (MRP)",
  country_of_origin: "Country of Origin",
  manufacture_date: "Date of Mfg / Packing",
  consumer_care: "Consumer Care Details",
};

export default function MismatchComparisonModal({
  isOpen,
  scanId,
  productName,
  onClose,
}: {
  isOpen: boolean;
  scanId: string | null;
  productName?: string;
  onClose: () => void;
}) {
  const [listings, setListings] = useState<MockListing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MismatchComparisonResult | null>(null);

  // Load available mock listings
  useEffect(() => {
    if (!isOpen) return;
    async function initListings() {
      try {
        const mockList = await fetchMockListings();
        setListings(mockList);
        // Default to best match or first listing
        if (mockList.length > 0 && !selectedListingId) {
          const match = mockList.find(
            (l) =>
              productName &&
              (l.product_name.toLowerCase().includes(productName.toLowerCase()) ||
                productName.toLowerCase().includes(l.product_name.toLowerCase()))
          );
          setSelectedListingId(match ? match.id : mockList[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load mock listings:", err);
      }
    }
    initListings();
  }, [isOpen, productName, selectedListingId]);

  // Execute comparison whenever scanId or selectedListingId changes
  useEffect(() => {
    if (!isOpen || !scanId) return;
    const targetScanId: string = scanId;
    async function runComparison() {
      setLoading(true);
      setError(null);
      try {
        const res = await compareScanListing(targetScanId, {
          listing_id: selectedListingId || undefined,
          product_name: productName,
        });
        setResult(res);
      } catch (err: any) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to perform physical vs. online listing comparison."
        );
      } finally {
        setLoading(false);
      }
    }
    runComparison();
  }, [isOpen, scanId, selectedListingId, productName]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-outline-variant bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary-container px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-on-primary">
                Signature Feature
              </span>
              <h2 className="text-lg font-bold text-on-surface">
                Physical Packaging vs. Online Marketplace Cross-Verification
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Cross-checks lab-scanned packaging declarations against e-commerce portal declarations under Legal Metrology E-Commerce Rules (Rule 6(10)).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Listing Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-lowest px-6 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-on-surface">Select Online Listing:</span>
            <select
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary-container"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  [{l.platform}] {l.product_name} ({l.seller_name})
                </option>
              ))}
            </select>
          </div>

          {result && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-on-surface-variant font-medium">Platform:</span>
              <span className="rounded bg-surface-container-high px-2.5 py-0.5 font-bold text-on-surface">
                {result.online_listing.platform}
              </span>
              <span className="text-on-surface-variant font-medium">Seller:</span>
              <span className="font-semibold text-on-surface">
                {result.online_listing.seller_name}
              </span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-container border-t-transparent" />
              <p className="text-sm font-medium">
                Cross-referencing physical declaration values with marketplace records…
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-violation/40 bg-violation-container/20 p-5 text-center">
              <p className="text-sm font-semibold text-violation">{error}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Ensure this scan has been persisted and has an active inspection ID.
              </p>
            </div>
          )}

          {!loading && !error && result && (
            <div className="flex flex-col gap-6">
              {/* Verdict Summary Card */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border p-4 ${
                  result.comparison.is_concordant
                    ? "border-compliant/40 bg-compliant-container/20"
                    : "border-violation/40 bg-violation-container/20"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${
                        result.comparison.is_concordant ? "bg-compliant" : "bg-violation"
                      }`}
                    />
                    <h3 className="text-base font-extrabold text-on-surface">
                      {result.comparison.is_concordant
                        ? "Perfect Concordance: Online Listing Matches Physical Packaging"
                        : `Discrepancy Alert: ${result.comparison.mismatch_count} Mismatches Detected`}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {result.comparison.is_concordant
                      ? "All mandatory statutory declarations advertised on the e-commerce listing align with the physical package label."
                      : "Consumers may be misled by differing price, quantity, or origin declarations between digital storefront and physical commodity."}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="rounded-lg bg-surface-container-lowest/90 px-3 py-2 text-center border border-outline-variant/40">
                    <p className="text-[10px] uppercase font-bold text-compliant">Matched</p>
                    <p className="text-lg font-extrabold text-compliant">
                      {result.comparison.match_count}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-container-lowest/90 px-3 py-2 text-center border border-outline-variant/40">
                    <p className="text-[10px] uppercase font-bold text-violation">Mismatches</p>
                    <p className="text-lg font-extrabold text-violation">
                      {result.comparison.mismatch_count}
                    </p>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
                <div className="grid grid-cols-12 border-b border-outline-variant bg-surface-container-low px-4 py-3 text-xs font-bold text-on-surface">
                  <div className="col-span-3">Statutory Field & Legal Clause</div>
                  <div className="col-span-4">Physical Packaging (Lab Scan)</div>
                  <div className="col-span-1 text-center">Verdict</div>
                  <div className="col-span-4">Online E-Commerce Listing</div>
                </div>

                <div className="divide-y divide-outline-variant">
                  {Object.entries(result.comparison.fields).map(([fieldKey, item]) => {
                    const isMismatch = item.status === "MISMATCH" || item.status.startsWith("MISSING");
                    return (
                      <div
                        key={fieldKey}
                        className={`grid grid-cols-12 items-center gap-2 p-4 text-xs transition-colors ${
                          isMismatch
                            ? "bg-violation-container/15 hover:bg-violation-container/25"
                            : "hover:bg-surface-container-low"
                        }`}
                      >
                        {/* Field & Rule Column */}
                        <div className="col-span-3 pr-2">
                          <p className="font-bold text-on-surface">
                            {FIELD_LABELS[fieldKey] || fieldKey}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">
                            {item.rule_reference}
                          </p>
                        </div>

                        {/* Physical Value */}
                        <div className="col-span-4 rounded-lg bg-surface p-2.5 border border-outline-variant/60">
                          <span className="label-caps text-on-surface-variant block mb-1">
                            Physical Label
                          </span>
                          <p className="font-semibold text-on-surface break-words">
                            {item.physical_value || (
                              <span className="italic text-on-surface-variant">Not detected</span>
                            )}
                          </p>
                        </div>

                        {/* Status Icon */}
                        <div className="col-span-1 flex flex-col items-center justify-center">
                          {item.status === "MATCH" ? (
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-compliant text-white text-xs font-bold"
                              title="Verified Concordant"
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violation text-white text-xs font-bold animate-pulse"
                              title={item.details}
                            >
                              ✕
                            </span>
                          )}
                        </div>

                        {/* Online Value */}
                        <div className="col-span-4 rounded-lg bg-surface p-2.5 border border-outline-variant/60">
                          <span className="label-caps text-on-surface-variant block mb-1">
                            Marketplace Listing
                          </span>
                          <p className="font-semibold text-on-surface break-words">
                            {item.online_value || (
                              <span className="italic text-on-surface-variant">Not declared</span>
                            )}
                          </p>
                        </div>

                        {/* Explanation callout if mismatch */}
                        {isMismatch && (
                          <div className="col-span-12 mt-2 rounded-md bg-violation/10 border border-violation/30 px-3 py-1.5 text-[11px] text-violation font-medium flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>{item.details}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-6 py-3.5">
          <p className="text-xs text-on-surface-variant">
            Official inspection decision-support tool. Officer review remains authoritative.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90"
          >
            Close Cross-Verification View
          </button>
        </div>
      </div>
    </div>
  );
}
