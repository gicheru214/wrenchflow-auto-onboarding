// Front-end → Edge Function client.
// API URL + anon key are read from Vite env at build, with a window-global override
// so a static host can inject them at runtime without rebuilding.

declare global {
  interface Window {
    WRENCHFLOW_AUTO_API?: string;
    WRENCHFLOW_AUTO_ANON_KEY?: string;
  }
}

const ENV_URL = import.meta.env.VITE_QUIZ_API_URL as string | undefined;
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const QUIZ_API_URL =
  (typeof window !== "undefined" && window.WRENCHFLOW_AUTO_API) ||
  ENV_URL ||
  "http://localhost:54321/functions/v1/quiz-submission";

export const ANON_KEY =
  (typeof window !== "undefined" && window.WRENCHFLOW_AUTO_ANON_KEY) ||
  ENV_KEY ||
  "";

export type Intent = "submit" | "connect";

export interface Contact {
  name?: string;
  email?: string;
  shop?: string;
}

export interface QuizPayload {
  sessionId: string;
  intent: Intent;
  contact: Contact;
  answers: Array<{
    qid: number;
    section: string;
    label: string;
    revBump: number;
  }>;
  revenue: number;
  score: number;
  durationMs: number;
  userAgent: string;
}

const PENDING_KEY = "wrenchflow.auto.pending";
const SESSION_KEY = "wrenchflow.auto.sessionId";

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export async function postSubmission(payload: QuizPayload): Promise<{
  ok: boolean;
  id?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const r = await fetch(QUIZ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ANON_KEY
          ? { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY }
          : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    try {
      const cache = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
      cache.push(payload);
      localStorage.setItem(PENDING_KEY, JSON.stringify(cache));
    } catch {
      /* ignore */
    }
    return { ok: false, cached: true, error: msg };
  }
}

export function emailValid(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
