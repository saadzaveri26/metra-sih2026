"use client";

import { useState } from "react";
import { SendIcon } from "@/components/icons";
import Avatar from "@/components/Avatar";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  source?: string;
};

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  function handleSend() {
    const text = draft.trim();
    if (!text) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };

    // TODO(Phase 12): replace with a real call to a /ask endpoint backed by
    // sentence-transformer retrieval over the rules text. This just echoes
    // a placeholder so the screen is testable end-to-end.
    const placeholderReply: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Ask METRA isn't wired to the rules database yet (Phase 12) — this is a placeholder reply so you can see the chat UI in action.",
    };

    setMessages((m) => [...m, userMsg, placeholderReply]);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
        <div className="h-9 w-9 overflow-hidden rounded-full border border-outline-variant bg-surface-container-high">
          <Avatar state="closeup" className="h-full w-full object-cover object-top" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-on-surface">METRA</h1>
          <p className="text-xs text-on-surface-variant">
            Answers based on Legal Metrology Rules, 2011
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mb-2 flex flex-col items-center gap-2 text-center">
            <Avatar state="converse" className="h-40 w-auto object-contain" />
            <p className="text-xs text-on-surface-variant px-8">
              Ask about a rule, a declaration requirement, or a violation
              you&apos;ve spotted in the field.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="border-t border-outline-variant px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about this product's compliance…"
            className="flex-1 rounded-lg border border-outline-variant px-3 py-2.5 text-sm text-on-surface outline-none focus:border-2 focus:border-primary-container"
          />
          <button
            type="button"
            onClick={handleSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary"
            aria-label="Send"
          >
            <SendIcon width={18} height={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-on-surface-variant">
          METRA provides reference information only. Final determination rests
          with the inspecting officer.
        </p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2.5 text-sm ${
          isUser
            ? "rounded-br-none bg-surface-container-high text-on-surface"
            : "rounded-bl-none border border-outline-variant bg-surface-container-lowest text-on-surface"
        }`}
      >
        {message.text}
        {message.source && (
          <p className="mt-2 rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">
            Source: {message.source}
          </p>
        )}
      </div>
    </div>
  );
}
