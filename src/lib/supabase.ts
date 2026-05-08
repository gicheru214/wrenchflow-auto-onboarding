// Front-end → Edge Function client.
// API URL + anon key are read from Vite env at build, with a window-global override
// so a static host can inject them at runtime without rebuilding.

declare global {
  interface Window {
    WRENCHFLOW_AUTO_API?: string;
    WRENCHFLOW_AUTO_ANON_KEY?: string;
    /** Set by the upstream funnel page that already captured the lead's email. */
    WRENCHFLOW_AUTO_LEAD?: { name?: string; email?: string; shop?: string };
  }
}

const LEAD_KEY = "wrenchflow.auto.lead";

/**
 * Returns the lead/contact captured upstream in the funnel (popup → 4Q → email gate
 * → quiz). Falls back to a window global, then localStorage, so the quiz can read it
 * regardless of whether the host page injects it on load or stashes it after capture.
 */
export function getUpstreamLead(): {
  name?: string;
  email?: string;
  shop?: string;
} {
  // 1. URL params win — that's how the parent funnel hands off across origins
  //    (popup at wrenchflow.com → iframe at audit.subdomain). localStorage
  //    is per-origin so it can't carry the lead across, but query string can.
  if (typeof window !== "undefined") {
    try {
      const p = new URLSearchParams(window.location.search);
      const fromUrl: { name?: string; email?: string; shop?: string } = {};
      const n = p.get("name");
      const e = p.get("email");
      const s = p.get("shop");
      if (n) fromUrl.name = n;
      if (e) fromUrl.email = e;
      if (s) fromUrl.shop = s;
      if (fromUrl.name || fromUrl.email || fromUrl.shop) return fromUrl;
    } catch {
      /* ignore */
    }
    if (window.WRENCHFLOW_AUTO_LEAD) return window.WRENCHFLOW_AUTO_LEAD;
  }
  try {
    const raw = localStorage.getItem(LEAD_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * Embed mode flag — the audit is hosted standalone, but when iframed by
 * the upstream funnel popup we drop the intro screen, skip the built-in
 * paywall (parent owns the $1 conversion), and replace the score-reveal
 * CTAs with a single "Show me how to fix this" handoff button.
 */
export function isEmbedMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("embed") === "1";
  } catch {
    return false;
  }
}

export function persistUpstreamLead(lead: {
  name?: string;
  email?: string;
  shop?: string;
}) {
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify(lead));
  } catch {
    /* ignore */
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
