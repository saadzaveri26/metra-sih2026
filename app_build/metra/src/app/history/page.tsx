"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchEntityHistory,
  fetchScanList,
  ApiError,
  type EntityHistoryResponse,
  type ScanSummary,
} from "@/lib/api";
import StatusChip from "@/components/StatusChip";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [product, setProduct] = useState(searchParams.get("product") ?? "");
  const [seller, setSeller] = useState(searchParams.get("seller") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") ?? "");
  const [items, setItems] = useState<ScanSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [entity, setEntity] = useState<EntityHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters = {
      q: searchParams.get("q") ?? "",
      product: searchParams.get("product") ?? "",
      seller: searchParams.get("seller") ?? "",
      status: searchParams.get("status") ?? "",
      date_from: searchParams.get("date_from") ?? "",
      date_to: searchParams.get("date_to") ?? "",
    };
    try {
      const list = await fetchScanList(filters);
      setItems(list.items);
      setTotal(list.total);
      const onlySeller = filters.seller && !filters.product && !filters.q && !filters.status;
      const onlyProduct = filters.product && !filters.seller && !filters.q && !filters.status;
      if (onlySeller || onlyProduct) {
        setEntity(
          await fetchEntityHistory({
            seller: onlySeller ? filters.seller : undefined,
            product: onlyProduct ? filters.product : undefined,
          })
        );
      } else {
        setEntity(null);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load inspection history."
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    setProduct(searchParams.get("product") ?? "");
    setSeller(searchParams.get("seller") ?? "");
    setStatus(searchParams.get("status") ?? "");
    setDateFrom(searchParams.get("date_from") ?? "");
    setDateTo(searchParams.get("date_to") ?? "");
    void load();
  }, [load, searchParams]);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (product.trim()) qs.set("product", product.trim());
    if (seller.trim()) qs.set("seller", seller.trim());
    if (status) qs.set("status", status);
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    router.push(`/history${qs.toString() ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-xl font-bold text-on-surface">Inspection History</h1>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2"
      >
        <label className="text-sm text-on-surface sm:col-span-2">
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ID, product, seller, manufacturer"
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-on-surface">
          Product
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-on-surface">
          Seller
          <input
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-on-surface">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="NEEDS_REVIEW">Needs review</option>
            <option value="NON_COMPLIANT">Non-compliant</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-on-surface">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-on-surface">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            Apply filters
          </button>
          <Link
            href="/history"
            className="rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface"
          >
            Clear
          </Link>
        </div>
      </form>

      {entity && (
        <section className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="flex items-center justify-between">
            <p className="label-caps text-on-surface-variant">
              History for {entity.entity_type}
            </p>
            {entity.entity_type === "seller" && (
              <Link
                href={`/sellers/${encodeURIComponent(entity.entity_name)}`}
                className="rounded-lg bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary hover:opacity-90"
              >
                View Trust Profile & Compliance Graph →
              </Link>
            )}
          </div>
          <h2 className="text-lg font-bold text-on-surface">{entity.entity_name}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {entity.total_scans} scans · {entity.compliant_count} compliant ·{" "}
            {entity.review_count} review · {entity.violations_count} violations
          </p>
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-violation-container px-3 py-2 text-sm text-violation">
          {error}
        </p>
      )}

      <p className="text-xs text-on-surface-variant">
        {loading ? "Loading…" : `${total} inspection${total === 1 ? "" : "s"}`}
      </p>

      <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
        {!loading && items.length === 0 && (
          <li className="px-4 py-6 text-sm text-on-surface-variant">
            No matching inspections. Scan a label to persist a record.
          </li>
        )}
        {items.map((scan) => (
          <li key={scan.id}>
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/history/${encodeURIComponent(scan.id)}`} className="min-w-0">
                <p className="text-sm font-bold text-on-surface">{scan.product_name}</p>
                <p className="text-xs text-on-surface-variant">
                  {scan.id} · {formatWhen(scan.created_at)} · score {scan.score}
                </p>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/sellers/${encodeURIComponent(scan.seller_name)}`}
                  className="text-xs font-semibold text-primary-container hover:underline"
                  title="View Seller Trust Profile & Compliance Graph"
                >
                  {scan.seller_name} (Trust Profile)
                </Link>
                <Link
                  href={`/history?product=${encodeURIComponent(scan.product_name)}`}
                  className="text-xs font-semibold text-on-surface-variant underline"
                >
                  Product history
                </Link>
                <StatusChip status={scan.overall_status} size="sm" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
