"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSellerCompliance,
  type SellerComplianceHistory,
  ApiError,
} from "@/lib/api";
import SellerComplianceGraph from "@/components/SellerComplianceGraph";
import { ArrowLeftIcon } from "@/components/icons";

export default function SellerProfilePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const resolvedParams = use(params);
  const sellerName = decodeURIComponent(resolvedParams.name);

  const [data, setData] = useState<SellerComplianceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSellerCompliance(sellerName);
        setData(res);
      } catch (err: any) {
        setError(
          err instanceof ApiError ? err.message : "Failed to load seller trust profile."
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sellerName]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant px-3 py-1.5 bg-surface-container-low"
        >
          <ArrowLeftIcon width={14} height={14} /> Back to Inspections
        </Link>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-container border-t-transparent" />
          <p className="text-sm font-medium">Aggregating statutory inspection history for {sellerName}…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
          <p className="text-sm font-semibold text-violation">{error}</p>
          <Link
            href="/history"
            className="mt-3 inline-block rounded-lg bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary"
          >
            Return to Inspection History
          </Link>
        </div>
      )}

      {!loading && !error && data && (
        <SellerComplianceGraph data={data} />
      )}
    </div>
  );
}
