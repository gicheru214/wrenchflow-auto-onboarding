// WrenchFlow Auto · quiz-submission Edge Function
// POST /functions/v1/quiz-submission
//   body: { sessionId, intent, contact, answers, revenue, score, durationMs, userAgent }
// Inserts one row into public.quiz_submissions and returns { id }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function clampInt(v: unknown, lo: number, hi: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function sanitizeContact(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const c = input as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of ["name", "email", "shop"]) {
    const v = c[k];
    if (typeof v === "string" && v.length <= 200) out[k] = v.trim();
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const intent = payload.intent === "connect" ? "connect" : "submit";
  const sessionId = typeof payload.sessionId === "string" && payload.sessionId.length <= 100
    ? payload.sessionId
    : crypto.randomUUID();
  const contact = sanitizeContact(payload.contact);
  const answers = Array.isArray(payload.answers) ? payload.answers.slice(0, 50) : [];
  const revenue = clampInt(payload.revenue, 0, 100_000_000);
  const score = clampInt(payload.score, 0, 100);
  const durationMs = clampInt(payload.durationMs, 0, 24 * 60 * 60 * 1000);
  const userAgent = typeof payload.userAgent === "string" ? payload.userAgent.slice(0, 500) : null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "server_misconfigured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("quiz_submissions")
    .insert({
      session_id: sessionId,
      intent,
      contact,
      answers,
      revenue,
      score,
      duration_ms: durationMs,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insert failed", error);
    return json({ error: "insert_failed", detail: error.message }, 500);
  }

  return json({ id: data.id, intent });
});
