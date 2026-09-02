"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SendIcon } from "@/components/icons";
import Avatar from "@/components/Avatar";
import { askAssistant, type AssistantResponse, type AssistantSections } from "@/lib/api";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  primaryClause?: {
    id: string;
    clause_ref: string;
    title: string;
    act_section: string;
  };
  matchedClauses?: Array<{
    id: string;
    clause_ref: string;
    title: string;
    relevance_score: number;
  }>;
  sections?: AssistantSections;
};

const SUGGESTED_QUERIES = [
  "Why is 'gms' prohibited for net quantity?",
  "What are the MRP tax inclusivity requirements?",
  "What is required for e-commerce country of origin under Rule 6(10)?",
  "What are the Section 36(1) penalties for repeat violations?",
  "What is the minimum font size for declarations under Rule 7?",
];

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-8 text-sm text-on-surface-variant">
          Loading Legal Metrology Assistant…
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}

function AssistantContent() {
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scan_id") || undefined;
  const initialQ = searchParams.get("q") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(initialQ);
  const [loading, setLoading] = useState(false);

  // Auto-send if initial query provided via URL
  useEffect(() => {
    if (initialQ && messages.length === 0) {
      void sendQuery(initialQ);
    }
  }, [initialQ]);

  async function sendQuery(queryText: string) {
    const text = queryText.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setLoading(true);

    try {
      const resp: AssistantResponse = await askAssistant(text, scanId);
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: resp.answer,
        primaryClause: resp.primary_clause,
        matchedClauses: resp.matched_clauses,
        sections: resp.sections,
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Could not retrieve statutory legal reference. Please ensure the backend is running.",
      };
      setMessages((m) => [...m, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col max-w-4xl mx-auto w-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3 bg-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-full border border-outline-variant bg-surface-container-high">
            <Avatar state="closeup" className="h-full w-full object-cover object-top" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-on-surface">Ask METRA</h1>
              <span className="rounded bg-primary-container/20 px-2 py-0.5 text-[10px] font-bold text-primary-container">
                Statutory Reference Assistant
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011
            </p>
          </div>
        </div>

        {scanId && (
          <span className="rounded-md border border-outline-variant bg-surface-container px-2.5 py-1 text-xs font-mono font-medium text-on-surface">
            Inspection Context: {scanId}
          </span>
        )}
      </div>

      {/* Message Area */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="my-auto flex flex-col items-center gap-4 text-center py-6">
            <Avatar state="converse" className="h-36 w-auto object-contain" />
            <div className="max-w-md">
              <h2 className="text-base font-bold text-on-surface">
                Legal Metrology Advisory Engine
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Direct statutory citations and officer guidance grounded in the Legal Metrology Act and PCR 2011.
              </p>
            </div>

            {/* Suggested prompts */}
            <div className="mt-2 flex flex-col gap-2 w-full max-w-lg text-left">
              <p className="label-caps text-on-surface-variant text-center">Suggested Inquiries</p>
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuery(q)}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5 text-xs text-on-surface hover:bg-surface-container transition-colors text-left font-medium"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-on-surface-variant py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
            <span>Retrieving statutory rule citations & legal guidance…</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="border-t border-outline-variant bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendQuery(draft)}
            placeholder="Ask about a statutory rule, clause, or penalty citation…"
            className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-hidden focus:ring-2 focus:ring-primary-container"
          />
          <button
            type="button"
            disabled={!draft.trim() || loading}
            onClick={() => sendQuery(draft)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
            aria-label="Send"
          >
            <SendIcon width={18} height={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-on-surface-variant">
          METRA provides statutory reference assistance for decision support. Final enforcement action rests with the authorized Legal Metrology Officer.
        </p>
      </div>
    </div>
  );
}

function parseTextSections(text: string) {
  const lines = text.split("\n");
  let currentSec = "";
  const buf: Record<string, string[]> = {
    ref: [],
    stat: [],
    guide: [],
    pen: [],
    find: [],
    other: [],
  };

  for (const rawLine of lines) {
    const clean = rawLine.replace(/[*_#]/g, "").trim();
    if (!clean) continue;

    if (/^Legal Reference[:\s]/i.test(clean)) {
      currentSec = "ref";
      buf.ref.push(clean.replace(/^Legal Reference[:\s]*/i, "").trim());
    } else if (/^Statutory Requirement[:\s]/i.test(clean)) {
      currentSec = "stat";
      const rest = clean.replace(/^Statutory Requirement[:\s]*/i, "").trim();
      if (rest) buf.stat.push(rest);
    } else if (/^Plain-Language Guidance[:\s]/i.test(clean) || /^Officer Guidance[:\s]/i.test(clean)) {
      currentSec = "guide";
      const rest = clean.replace(/^Plain-Language Guidance(?: for Officers)?[:\s]*/i, "").trim();
      if (rest) buf.guide.push(rest);
    } else if (/^Penal Sanction[:\s]/i.test(clean) || /^Penalties?[:\s]/i.test(clean)) {
      currentSec = "pen";
      const rest = clean.replace(/^Penal Sanction(?: \/ Consequences)?[:\s]*/i, "").trim();
      if (rest) buf.pen.push(rest);
    } else if (/^Specific Inspection Finding[:\s]/i.test(clean)) {
      currentSec = "find";
      const rest = clean.replace(/^Specific Inspection Finding[^:]*[:\s]*/i, "").trim();
      if (rest) buf.find.push(rest);
    } else {
      if (currentSec && buf[currentSec]) {
        buf[currentSec].push(clean);
      } else {
        buf.other.push(clean);
      }
    }
  }

  return {
    ref: buf.ref.join(" "),
    statutory: buf.stat.join(" "),
    guidance: buf.guide.join(" "),
    penalty: buf.pen.join(" "),
    finding: buf.find.join("\n"),
    other: buf.other.join("\n"),
  };
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary shadow-xs">
          {message.text}
        </div>
      </div>
    );
  }

  // Extract structured sections (either directly from API or fallback parsed from text)
  const sec = message.sections;
  const parsed = parseTextSections(message.text);

  const legalRef = sec?.legal_reference || parsed.ref || (message.primaryClause ? `${message.primaryClause.clause_ref} — ${message.primaryClause.title}` : "");
  const statutoryText = sec?.statutory_requirement || parsed.statutory;
  const guidanceText = sec?.officer_guidance || parsed.guidance;
  const penaltyText = sec?.penal_sanction || parsed.penalty;
  const finding = sec?.inspection_finding;
  const findingText = finding ? `${finding.product}: ${finding.status} — ${finding.findings}` : parsed.finding;
  const fallbackOther = parsed.other;

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] sm:max-w-[90%] rounded-2xl rounded-tl-xs border border-outline-variant/70 bg-surface-container-lowest p-5 text-on-surface shadow-xs space-y-4">
        {/* Header: Statutory Reference Title & Citation */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container text-on-primary text-xs">
              ⚖️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary-container/15 px-2 py-0.5 text-xs font-bold text-primary-container">
                  {message.primaryClause?.clause_ref || "Statutory Rule"}
                </span>
                <span className="text-xs font-bold text-on-surface">
                  {message.primaryClause?.title || legalRef}
                </span>
              </div>
              {message.primaryClause?.act_section && (
                <p className="text-[11px] font-medium text-on-surface-variant mt-0.5">
                  Governed under {message.primaryClause.act_section}
                </p>
              )}
            </div>
          </div>
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-semibold text-on-surface-variant">
            Verified Legal Metrology Law
          </span>
        </div>

        {/* 1. Statutory Mandate Card */}
        {statutoryText ? (
          <div className="rounded-xl border border-primary-container/20 bg-primary-container/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-primary-container">
              <span>📜</span> Statutory Requirement
            </div>
            <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
              {statutoryText}
            </p>
          </div>
        ) : null}

        {/* 2. Plain-Language Guidance for Officers */}
        {guidanceText ? (
          <div className="rounded-xl border border-outline-variant/70 bg-surface-container-low p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-on-surface-variant">
              <span>💡</span> Enforcement Guidance for Officers
            </div>
            <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
              {guidanceText}
            </p>
          </div>
        ) : null}

        {/* 3. Penalties & Legal Sanctions */}
        {penaltyText ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-amber-900 dark:text-amber-200">
              <span>⚠️</span> Penal Sanctions & Consequences
            </div>
            <p className="text-xs sm:text-sm font-medium text-on-surface leading-relaxed">
              {penaltyText}
            </p>
          </div>
        ) : null}

        {/* 4. Active Inspection Context (if present) */}
        {findingText ? (
          <div className="rounded-xl border border-error/25 bg-error/10 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-error">
              <span>🔍</span> Active Inspection Finding
            </div>
            <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-medium">
              {findingText}
            </p>
          </div>
        ) : null}

        {/* Fallback if no sections were parsed */}
        {!statutoryText && !guidanceText && !penaltyText && fallbackOther && (
          <div className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
            {fallbackOther}
          </div>
        )}

        {/* Related Statutory References */}
        {message.matchedClauses && message.matchedClauses.length > 1 && (
          <div className="border-t border-outline-variant/60 pt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className="font-semibold">Related Provisions:</span>
            {message.matchedClauses.slice(1).map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-md bg-surface-container px-2 py-0.5 font-medium text-primary-container"
              >
                {c.clause_ref} ({Math.round(c.relevance_score * 100)}% match)
              </span>
            ))}
          </div>
        )}

        {/* Official Source Attribution Banner */}
        <div className="flex items-center justify-between rounded-lg bg-surface-container px-3 py-2 text-[11px] text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span>🏛️</span>
            <span>
              <strong>Authority Source:</strong> Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011 (Ministry of Consumer Affairs, Food & Public Distribution)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
