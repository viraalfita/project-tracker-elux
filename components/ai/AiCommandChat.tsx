"use client";

import { pb } from "@/lib/pocketbase";
import { Bot, ChevronDown, Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SummaryData {
  intent: string;
  label: string;
  rows: Array<{ label: string; value: string }>;
  isDangerous?: boolean;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  status?:
    | "collecting_fields"
    | "success"
    | "error"
    | "unknown"
    | "cancelled"
    | "ready_to_confirm"
    | "answer";
  summary?: SummaryData;
  rateLimitPct?: number;
}

interface RateLimitData {
  credit_limit: number | null;
  credit_remaining: number | null;
}

const STORAGE_KEY = "ai_chat_history";
const OPEN_KEY = "ai_chat_open";

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  text: 'Halo! Ketik perintahmu langsung, misalnya: "buatkan epic Project X, owner vira" atau "cek status task Design Mockup".',
};

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [INITIAL_MESSAGE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [INITIAL_MESSAGE];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [INITIAL_MESSAGE];
    // Discard history that contains old-format summaries (pre-rows schema)
    const hasStale = parsed.some(
      (m) =>
        m.summary && !Array.isArray((m.summary as { rows?: unknown }).rows),
    );
    if (hasStale) {
      localStorage.removeItem(STORAGE_KEY);
      return [INITIAL_MESSAGE];
    }
    return parsed;
  } catch {
    return [INITIAL_MESSAGE];
  }
}

export function AiCommandChat() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(OPEN_KEY) === "true";
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, String(open));
    } catch {
      // ignore
    }
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Global shortcut: Cmd/Ctrl + I
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const token = pb.authStore.token;
      const body: Record<string, unknown> = { message: text };

      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const reply = data.reply ?? "Terjadi kesalahan. Coba lagi.";
      const creditLimit = (data.rate_limit as RateLimitData | undefined)
        ?.credit_limit;
      const creditRemaining = (data.rate_limit as RateLimitData | undefined)
        ?.credit_remaining;
      const rateLimitPct =
        creditLimit && creditRemaining != null
          ? Math.max(
              0,
              Math.min(100, Math.floor((creditRemaining / creditLimit) * 100)),
            )
          : undefined;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: reply,
          status: data.status,
          summary: data.summary,
          rateLimitPct,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Koneksi gagal. Periksa jaringanmu dan coba lagi.",
          status: "error",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const token = pb.authStore.token;
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply ?? "Selesai.",
          status: data.status,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Koneksi gagal. Coba lagi.",
          status: "error",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const token = pb.authStore.token;
      await fetch("/api/ai/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cancel: true }),
      });
    } catch {
      // ignore network errors on cancel
    } finally {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Perintah dibatalkan.",
          status: "cancelled",
        },
      ]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearChat() {
    // Also cancel any pending draft server-side (fire-and-forget)
    const token = pb.authStore.token;
    fetch("/api/ai/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cancel: true }),
    }).catch(() => {});

    const reset: Message[] = [INITIAL_MESSAGE];
    setMessages(reset);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
        title="AI Assistant (⌘I)"
        aria-label="Open AI command chat"
      >
        <Bot className="h-5 w-5" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-80 flex-col rounded-xl border border-border bg-white shadow-2xl sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-indigo-600 px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-semibold">AI Command</span>
              <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-medium">
                BETA
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="rounded p-1 text-indigo-200 hover:bg-indigo-500 hover:text-white transition-colors"
                title="Clear chat"
                aria-label="Clear chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-indigo-200 hover:bg-indigo-500 hover:text-white transition-colors"
                title="Minimize"
                aria-label="Minimize chat"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto p-4 text-sm">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "user"
                    ? "self-end max-w-[85%] rounded-xl rounded-br-sm bg-indigo-600 px-3 py-2 text-white"
                    : "self-start max-w-[90%] rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-800"
                }
              >
                {msg.status === "success" && (
                  <div className="mb-1.5 space-y-1">
                    <span className="block text-xs font-semibold text-green-600">
                      ✓ Berhasil
                    </span>
                    <button
                      onClick={() => {
                        try {
                          localStorage.setItem(OPEN_KEY, "true");
                        } catch {
                          // ignore
                        }
                        window.location.reload();
                      }}
                      className="block text-[10px] text-indigo-600 underline underline-offset-2 hover:text-indigo-800 transition-colors"
                    >
                      Refresh halaman untuk melihat data terbaru →
                    </button>
                  </div>
                )}
                {msg.status === "answer" && (
                  <span className="mb-1 block text-xs font-semibold text-sky-600">
                    ℹ️ Info
                  </span>
                )}
                {msg.status === "error" && (
                  <span className="mb-1 block text-xs font-semibold text-red-500">
                    ✕ Gagal
                  </span>
                )}
                {msg.status === "ready_to_confirm" && msg.summary ? (
                  <div className="space-y-2">
                    <p className="font-medium text-slate-700">{msg.text}</p>
                    <div
                      className={`rounded-lg border p-3 text-xs space-y-1.5 ${
                        msg.summary.isDangerous
                          ? "border-red-200 bg-red-50"
                          : "border-indigo-200 bg-indigo-50"
                      }`}
                    >
                      <div
                        className={`font-semibold uppercase tracking-wide text-[10px] mb-2 ${
                          msg.summary.isDangerous
                            ? "text-red-700"
                            : "text-indigo-700"
                        }`}
                      >
                        {msg.summary.isDangerous && "⚠ "}
                        {msg.summary.label}
                      </div>
                      {(msg.summary.rows ?? []).map((row, ri) => (
                        <div key={ri} className="flex gap-1">
                          <span className="text-slate-500 w-20 shrink-0">
                            {row.label}
                          </span>
                          <span className="font-medium text-slate-800">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition-colors ${
                          msg.summary.isDangerous
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {msg.summary.isDangerous ? "Ya, Hapus" : "OK, Simpan"}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                    {msg.role === "assistant" && msg.rateLimitPct != null && (
                      <p className="text-[10px] font-medium text-slate-400">
                        Credit {msg.rateLimitPct}%
                      </p>
                    )}
                  </div>
                )}
                {msg.status === "ready_to_confirm" &&
                  msg.role === "assistant" &&
                  msg.rateLimitPct != null && (
                    <p className="mt-2 text-[10px] font-medium text-slate-400">
                      Credit {msg.rateLimitPct}%
                    </p>
                  )}
              </div>
            ))}

            {loading && (
              <div className="self-start flex items-center gap-2 rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs">Memproses…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="rounded-b-xl border-t border-border bg-slate-50 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik perintahmu di sini…"
                disabled={loading}
                className="flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Enter kirim · Shift+Enter baris baru · ⌘I buka/tutup
            </p>
          </div>
        </div>
      )}
    </>
  );
}
