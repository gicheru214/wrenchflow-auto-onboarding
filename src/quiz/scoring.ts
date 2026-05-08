import type { Question } from "./data";

export interface AnswerRecord {
  qid: number;
  optIdx: number;
  revealed: boolean;
}

/** Higher index = more painful answer = bigger revBump weight. */
export function bumpFor(q: Question, optIdx: number): number {
  const n = q.opts.length;
  if (n <= 1) return q.revBump;
  // First option = best (small bump), last = worst (full bump).
  const weight = optIdx / (n - 1);
  return Math.round(q.revBump * (0.35 + 0.65 * weight));
}

export function totalRevenue(
  questions: Question[],
  answers: Record<number, AnswerRecord>,
): number {
  let total = 0;
  for (const [k, a] of Object.entries(answers)) {
    const q = questions[Number(k)];
    if (q && typeof a.optIdx === "number") {
      total += bumpFor(q, a.optIdx);
    }
  }
  return total;
}

/** 0–100. More-painful average answers → lower score. */
export function shopProfitScore(
  questions: Question[],
  answers: Record<number, AnswerRecord>,
): number {
  const entries = Object.entries(answers);
  if (entries.length === 0) return 0;
  let weighted = 0;
  for (const [k, a] of entries) {
    const q = questions[Number(k)];
    if (!q) continue;
    const n = q.opts.length;
    weighted += n <= 1 ? 0.5 : a.optIdx / (n - 1);
  }
  const avgPain = weighted / entries.length;
  // Pain 0 → 92, pain 1 → 38. Realistic floor/ceiling.
  return Math.round(92 - avgPain * 54);
}
