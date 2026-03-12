"use client";

import { pb } from "@/lib/pocketbase";
import { Bot, ChevronDown, Loader2, Send, X, Zap } from "lucide-react";
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
}

const INTENT_GROUPS = [
  {
    group: "Epic",
    intents: [
      { id: "create_epic", label: "Buat Epic" },
      { id: "create_epic_with_tasks", label: "Buat Epic + Task" },
      { id: "update_epic", label: "Edit Epic" },
      { id: "delete_epic", label: "Hapus Epic", isDangerous: true },
    ],
  },
  {
    group: "Task",
    intents: [
      { id: "create_task", label: "Buat Task" },
      { id: "update_task", label: "Edit Task" },
      { id: "delete_task", label: "Hapus Task", isDangerous: true },
    ],
  },
  {
    group: "Subtask",
    intents: [
      { id: "create_subtask", label: "Buat Subtask" },
      { id: "update_subtask", label: "Edit Subtask" },
      { id: "delete_subtask", label: "Hapus Subtask", isDangerous: true },
    ],
  },
  {
    group: "Goal",
    intents: [
      { id: "create_goal", label: "Buat Goal" },
      { id: "update_goal", label: "Edit Goal" },
      { id: "delete_goal", label: "Hapus Goal", isDangerous: true },
    ],
  },
  {
    group: "Lainnya",
    intents: [{ id: "link_epic_to_goal", label: "Hubungkan Epic ke Goal" }],
  },
  {
    group: "Tanya Info",
    intents: [
      { id: "query_epic", label: "Info Epic" },
      { id: "query_task", label: "Info Task" },
      { id: "query_goal", label: "Info Goal" },
      { id: "query_subtask", label: "Info Subtask" },
      { id: "query_member_work", label: "Pekerjaan Member" },
    ],
  },
];

const INTENT_HINTS: Record<string, string> = {
  create_epic:
    "Contoh: buatkan epic Research Design Q3 dengan owner vira, mulai 1 jan, selesai 31 mar",
  create_epic_with_tasks:
    "Contoh: buatkan epic Rebrand mulai 1 jan dan selesai 31 mar, owner vira, task: design mockup assign dewi, coding API assign vira",
  update_epic:
    "Contoh: ubah epic Research Design, ganti statusnya jadi In Progress",
  delete_epic: "Contoh: hapus epic Research Design Q3",
  create_task:
    "Contoh: buatkan task Design Mockup di epic Rebrand, assignee dewi, due 15 feb",
  update_task: "Contoh: ubah task Design Mockup, ganti prioritas jadi High",
  delete_task: "Contoh: hapus task Design Mockup dari epic Rebrand",
  create_subtask:
    "Contoh: buatkan subtask wireframe di task Design Mockup, assignee vira",
  update_subtask: "Contoh: ubah subtask wireframe, tandai sebagai Done",
  delete_subtask: "Contoh: hapus subtask wireframe dari task Design Mockup",
  create_goal: "Contoh: buatkan goal Tingkatkan Revenue Q1, target 200%",
  update_goal: "Contoh: ubah goal Revenue Q1, perbarui status jadi At Risk",
  delete_goal: "Contoh: hapus goal Revenue Q1",
  link_epic_to_goal:
    "Contoh: hubungkan epic Research Design dan epic Rebrand ke goal Revenue Q1",
  query_epic: "Contoh: redesign siakad statusnya apa? / info epic landing page",
  query_task:
    "Contoh: task design mockup sudah selesai belum? / info task coding API",
  query_goal: "Contoh: goal revenue Q1 progress KPI-nya gimana?",
  query_subtask: "Contoh: subtask wireframe sudah selesai belum?",
  query_member_work:
    "Contoh: Vira lagi ngerjain task apa aja? / beban kerja Dewi di epic mana?",
};

const STORAGE_KEY = "ai_chat_history";
const INTENT_KEY = "ai_selected_intent";

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  text: "Halo! Pilih jenis perintah di bawah untuk memulai.",
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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [loading, setLoading] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(INTENT_KEY);
  });

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

  // Persist selectedIntent
  useEffect(() => {
    try {
      if (selectedIntent) {
        localStorage.setItem(INTENT_KEY, selectedIntent);
      } else {
        localStorage.removeItem(INTENT_KEY);
      }
    } catch {
      // ignore
    }
  }, [selectedIntent]);

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

  // Show intent picker when no intent selected and conversation is at a natural stop
  const lastMsg = messages[messages.length - 1];
  const showIntentPicker =
    !selectedIntent &&
    !loading &&
    (messages.length <= 1 ||
      lastMsg?.status === "success" ||
      lastMsg?.status === "cancelled" ||
      lastMsg?.status === "error" ||
      lastMsg?.status === "answer");

  function selectIntent(intentId: string) {
    setSelectedIntent(intentId);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  const selectedIntentObj = INTENT_GROUPS.flatMap((g) => g.intents).find(
    (i) => i.id === selectedIntent,
  );

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
      if (selectedIntent) body.preselected_intent = selectedIntent;

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

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: reply,
          status: data.status,
          summary: data.summary,
        },
      ]);
      if (data.status === "success" || data.status === "answer") {
        setSelectedIntent(null);
      }
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
      if (data.status === "success") {
        setSelectedIntent(null);
      }
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
      setSelectedIntent(null);
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
    setSelectedIntent(null);
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
                      onClick={() => window.location.reload()}
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
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {msg.text}
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

          {/* Intent picker — shown when no intent is selected and conversation is idle */}
          {showIntentPicker && (
            <div className="border-t border-border px-4 py-3 space-y-2 max-h-52 overflow-y-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Pilih jenis perintah
              </p>
              {INTENT_GROUPS.map((group) => (
                <div key={group.group}>
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium">
                    {group.group}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.intents.map((intent) => (
                      <button
                        key={intent.id}
                        onClick={() => selectIntent(intent.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                          intent.isDangerous
                            ? "border-red-200 text-red-700 hover:bg-red-50"
                            : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        }`}
                      >
                        {intent.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active intent badge + change button */}
          {selectedIntent && (
            <div className="border-t border-border px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-indigo-600" />
                <span
                  className={`text-[11px] font-semibold ${
                    selectedIntentObj?.isDangerous
                      ? "text-red-700"
                      : "text-indigo-700"
                  }`}
                >
                  {selectedIntentObj?.label ?? selectedIntent}
                </span>
              </div>
              <button
                onClick={() => setSelectedIntent(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Ganti
              </button>
            </div>
          )}

          {/* Hint text for selected intent */}
          {selectedIntent && INTENT_HINTS[selectedIntent] && (
            <div className="px-4 pb-1">
              <p className="text-[10px] text-muted-foreground italic">
                {INTENT_HINTS[selectedIntent]}
              </p>
            </div>
          )}

          {/* Input */}
          <div className="rounded-b-xl border-t border-border bg-slate-50 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedIntent
                    ? "Ketik perintahmu di sini…"
                    : "Pilih jenis perintah terlebih dahulu…"
                }
                disabled={loading || !selectedIntent}
                className="flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || !selectedIntent}
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
