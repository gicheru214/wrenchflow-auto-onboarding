import { useEffect, useMemo, useRef, useState } from "react";
import { QUESTIONS } from "../quiz/data";
import {
  AnswerRecord,
  bumpFor,
  shopProfitScore,
  totalRevenue,
} from "../quiz/scoring";
import {
  getReturnUrl,
  getSessionId,
  getUpstreamLead,
  isEmbedMode,
  postSubmission,
  type Contact,
} from "../lib/supabase";
import AutoBubble from "./AutoBubble";
import MoneyLine from "./MoneyLine";
import Topbar from "./Topbar";
import Toast, { ToastKind } from "./Toast";
import { burstFrom } from "./MoneyParticles";

type Step = "intro" | number | "paywall" | "score";

export default function QuizFlow() {
  // Embed mode = audit is being hosted inside the upstream popup iframe.
  // Skip the local intro screen and the built-in paywall; the parent funnel
  // already showed an intro card and owns the $1 conversion that follows.
  const embed = useMemo(() => isEmbedMode(), []);
  const [step, setStep] = useState<Step>(embed ? 0 : "intro");
  const [answers, setAnswers] = useState<Record<number, AnswerRecord>>({});
  // Lead is captured upstream (popup → email gate). The quiz reads it; it never re-asks.
  const lead = useMemo<Contact>(() => getUpstreamLead(), []);
  const [submitting, setSubmitting] = useState(false);
  const [connectSent, setConnectSent] = useState(false);
  const [emailResults, setEmailResults] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(
    null,
  );
  const startedAt = useRef(Date.now());

  const total = useMemo(() => totalRevenue(QUESTIONS, answers), [answers]);
  const score = useMemo(() => shopProfitScore(QUESTIONS, answers), [answers]);

  const stepLabel =
    step === "intro"
      ? "Intro"
      : step === "paywall"
        ? "Paywall"
        : step === "score"
          ? "Score reveal"
          : `Q${(step as number) + 1}`;
  const stepCount =
    step === "intro"
      ? `0 / ${QUESTIONS.length}`
      : step === "paywall"
        ? `${QUESTIONS.length} / ${QUESTIONS.length}`
        : step === "score"
          ? "✓"
          : `${(step as number) + 1} / ${QUESTIONS.length}`;

  function go(next: Step) {
    setStep(next);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function handleChoice(qid: number, optIdx: number, btn: HTMLElement) {
    setAnswers((prev) => ({
      ...prev,
      [qid]: { qid, optIdx, revealed: true },
    }));
    burstFrom(btn, 16);
  }

  function next(qid: number) {
    if (qid + 1 >= QUESTIONS.length) {
      // Embed mode skips the paywall — submit silently and reveal the score.
      // The parent popup owns the $1 conversion that follows.
      if (embed) void unlockScore();
      else go("paywall");
    } else {
      go(qid + 1);
    }
  }

  function handoffToParent() {
    if (typeof window === "undefined") return;
    // Subpage mode: parent funnel passed `?return=…` when it redirected
    // here. Bounce back with score/revenue/sid so the popup re-opens at
    // the $1 offer step.
    const returnUrl = getReturnUrl();
    if (returnUrl) {
      try {
        const u = new URL(returnUrl);
        u.searchParams.set("score", String(score));
        u.searchParams.set("revenue", String(total));
        u.searchParams.set("sid", getSessionId());
        if (lead.email) u.searchParams.set("email", lead.email);
        window.location.assign(u.toString());
        return;
      } catch {
        /* malformed return URL — fall through to postMessage */
      }
    }
    // Iframe fallback: the parent is listening for `wf-audit-done`.
    try {
      window.parent?.postMessage(
        {
          type: "wf-audit-done",
          score,
          revenue: total,
          sessionId: getSessionId(),
          email: lead.email ?? null,
        },
        "*",
      );
    } catch {
      /* ignore — parent may have closed */
    }
  }

  async function unlockScore() {
    setSubmitting(true);
    const payload = {
      sessionId: getSessionId(),
      intent: "submit" as const,
      contact: {
        name: lead.name?.trim(),
        email: lead.email?.trim(),
        shop: lead.shop?.trim(),
      },
      answers: Object.values(answers).map((a) => {
        const q = QUESTIONS[a.qid];
        return {
          qid: a.qid,
          section: q.section,
          label: q.opts[a.optIdx],
          revBump: bumpFor(q, a.optIdx),
        };
      }),
      revenue: total,
      score,
      durationMs: Date.now() - startedAt.current,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };
    const result = await postSubmission(payload);
    setSubmitting(false);
    go("score");
    setToast({
      msg: result.ok
        ? `Saved. Welcome${lead.name ? `, ${lead.name}` : ""}.`
        : "Saved locally — we'll sync when back online.",
      kind: result.ok ? "ok" : "err",
    });
  }

  async function sendResultsByEmail() {
    if (emailSent) return;
    setEmailSent(true);
    await postSubmission({
      sessionId: getSessionId(),
      intent: "email_results" as unknown as "submit",
      contact: {
        name: lead.name?.trim(),
        email: lead.email?.trim(),
        shop: lead.shop?.trim(),
      },
      answers: Object.values(answers).map((a) => {
        const q = QUESTIONS[a.qid];
        return {
          qid: a.qid,
          section: q.section,
          label: q.opts[a.optIdx],
          revBump: bumpFor(q, a.optIdx),
        };
      }),
      revenue: total,
      score,
      durationMs: Date.now() - startedAt.current,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    });
    setToast({
      msg: lead.email
        ? `Sent to ${lead.email}.`
        : "We'll email your results shortly.",
      kind: "ok",
    });
  }

  async function connectShop() {
    if (connectSent) return;
    setConnectSent(true);
    await postSubmission({
      sessionId: getSessionId(),
      intent: "connect",
      contact: {
        name: lead.name?.trim(),
        email: lead.email?.trim(),
        shop: lead.shop?.trim(),
      },
      answers: Object.values(answers).map((a) => {
        const q = QUESTIONS[a.qid];
        return {
          qid: a.qid,
          section: q.section,
          label: q.opts[a.optIdx],
          revBump: bumpFor(q, a.optIdx),
        };
      }),
      revenue: total,
      score,
      durationMs: Date.now() - startedAt.current,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    });
    setToast({ msg: "Got it — Auto will reach out within an hour.", kind: "ok" });
  }

  return (
    <div className="min-h-full bg-bg pb-24">
      <Topbar stepLabel={stepLabel} stepCount={stepCount} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-5 sm:px-6">
        {step === "intro" && (
          <IntroScreen
            onStart={() => go(0)}
            qCount={QUESTIONS.length}
          />
        )}

        {typeof step === "number" && (
          <QuestionScreen
            key={step}
            qid={step}
            answer={answers[step]}
            total={total}
            onPick={handleChoice}
            onNext={() => next(step as number)}
            onBack={
              (step as number) > 0 ? () => go((step as number) - 1) : undefined
            }
          />
        )}

        {step === "paywall" && (
          <PaywallScreen
            total={total}
            lead={lead}
            submitting={submitting}
            onUnlock={unlockScore}
            onBack={() => go(QUESTIONS.length - 1)}
          />
        )}

        {step === "score" && (
          <ScoreScreen
            total={total}
            score={score}
            answers={answers}
            lead={lead}
            connectSent={connectSent}
            onConnect={connectShop}
            emailResults={emailResults}
            onToggleEmail={setEmailResults}
            emailSent={emailSent}
            onSendEmail={sendResultsByEmail}
            embed={embed}
            onHandoff={handoffToParent}
          />
        )}
      </main>

      <Toast
        msg={toast?.msg || null}
        kind={toast?.kind}
        onDone={() => setToast(null)}
      />
    </div>
  );
}

// ---------- Intro ----------
function IntroScreen({
  onStart,
  qCount,
}: {
  onStart: () => void;
  qCount: number;
}) {
  return (
    <div className="space-y-6 pt-4 sm:pt-8 animate-rise">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue/30 bg-blue/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue">
          🔧 Shop Profit Diagnostic
        </div>
        <h1 className="mt-5 text-3xl sm:text-5xl font-black leading-[1.05] tracking-tight">
          See where the money's hiding
          <br />
          <span className="bg-auto-grad bg-clip-text text-transparent">
            in your shop.
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sub">
          {qCount} questions. ~3 minutes. Auto walks you through the same
          diagnostic the top 1% of independent shops use to find $50K–$300K of
          recoverable revenue every year.
        </p>
      </div>

      <AutoBubble>
        <p>
          I'm <strong className="text-blue">Auto</strong> — your WrenchFlow
          co-pilot. I'll ask you {qCount} short questions, then show you the
          exact dollar number we can recover together. No fluff. No spreadsheets
          to fill in.
        </p>
      </AutoBubble>

      <button
        onClick={onStart}
        className="block w-full rounded-2xl bg-auto-grad px-5 py-4 text-base font-extrabold text-white shadow-xl shadow-blue/20 transition-transform active:scale-[0.98]"
      >
        Start the diagnostic →
      </button>
    </div>
  );
}

// ---------- Question ----------
function QuestionScreen({
  qid,
  answer,
  total,
  onPick,
  onNext,
  onBack,
}: {
  qid: number;
  answer?: AnswerRecord;
  total: number;
  onPick: (qid: number, optIdx: number, btn: HTMLElement) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const q = QUESTIONS[qid];
  const revealed = !!answer?.revealed;
  const revealRef = useRef<HTMLDivElement | null>(null);

  // After a pick, scroll the Reveal panel into view so the educational
  // content (Industry avg / Revenue hit / Auto's plan) is what the user
  // sees next — not the option list above. The sticky CTA bar keeps
  // Next visible regardless.
  useEffect(() => {
    if (!revealed) return;
    const el = revealRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
  }, [revealed]);

  return (
    <div className="space-y-3 animate-rise pb-24">
      <ProgressBar value={(qid + 1) / QUESTIONS.length} qid={qid} />
      <MoneyLine total={total} />
      <AutoBubble>{q.autoIntro}</AutoBubble>

      <section>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue">
          {q.section}
        </div>
        <h2 className="mt-0.5 text-base sm:text-lg font-extrabold leading-snug">
          {q.text}
        </h2>

        <div className="mt-2.5 grid gap-1.5">
          {q.opts.map((opt, i) => {
            const picked = answer?.optIdx === i;
            return (
              <button
                key={i}
                onClick={(e) => onPick(qid, i, e.currentTarget)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13px] font-semibold transition active:scale-[0.99] ${
                  picked
                    ? "border-blue bg-blue/10 text-ink"
                    : "border-line bg-card hover:border-blue/40 hover:bg-card/70 text-ink"
                }`}
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                    picked ? "border-blue bg-blue" : "border-line"
                  }`}
                >
                  {picked && <span className="h-1.5 w-1.5 rounded-full bg-bg" />}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
      </section>

      {revealed && (
        <div ref={revealRef}>
          <Reveal q={q} />
        </div>
      )}

      {/* Sticky CTA bar — keeps Next above the fold no matter the viewport. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {onBack ? (
            <button
              onClick={onBack}
              className="rounded-lg border border-line px-3 py-2.5 text-sm font-bold text-sub hover:text-ink"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onNext}
            disabled={!revealed}
            className="rounded-lg bg-auto-grad px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-blue/20 disabled:opacity-40 disabled:shadow-none"
          >
            {qid + 1 === QUESTIONS.length ? "See my score →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Reveal({ q }: { q: { avg: string; hit: string; goal: string } }) {
  return (
    <div
      data-reveal="1"
      className="grid gap-2 rounded-xl border border-line bg-card/60 px-3 py-2.5 animate-rise"
    >
      <Row label="Industry avg">
        <span dangerouslySetInnerHTML={{ __html: q.avg }} />
      </Row>
      <Row label="Revenue hit" tone="warn">
        <span dangerouslySetInnerHTML={{ __html: q.hit }} />
      </Row>
      <Row label="Auto's plan" tone="ok">
        {q.goal}
      </Row>
    </div>
  );
}

function Row({
  label,
  tone = "neutral",
  children,
}: {
  label: string;
  tone?: "neutral" | "warn" | "ok";
  children: React.ReactNode;
}) {
  const dot =
    tone === "warn"
      ? "bg-gold"
      : tone === "ok"
        ? "bg-money"
        : "bg-sub";
  return (
    <div className="flex gap-2.5 text-[12.5px]">
      <div className="shrink-0 pt-1">
        <span className={`block h-1.5 w-1.5 rounded-full ${dot}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sub">
          {label}
        </div>
        <div className="text-ink leading-snug">{children}</div>
      </div>
    </div>
  );
}

function ProgressBar({ value, qid }: { value: number; qid: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] uppercase tracking-[0.18em] text-sub">
        <span>
          Question {qid + 1} of {QUESTIONS.length}
        </span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-blue transition-all duration-500"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------- Paywall ----------
function PaywallScreen({
  total,
  lead,
  submitting,
  onUnlock,
  onBack,
}: {
  total: number;
  lead: Contact;
  submitting: boolean;
  onUnlock: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5 animate-rise">
      <AutoBubble>
        Alright — I've got your full picture. Before I show you the score,
        here's the deal: this is the hard number, and it's bigger than most
        shops expect. Take a breath.
      </AutoBubble>

      <div className="rounded-2xl border border-blue/30 bg-card p-5 sm:p-6 shadow-xl shadow-blue/10">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue">
          Diagnostic complete · {QUESTIONS.length} / {QUESTIONS.length}
        </div>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black leading-tight">
          Your Hidden Money Score is ready.
          <br />
          <span className="text-sub font-bold text-lg sm:text-xl">
            Unlock it to see exactly where the money is hiding.
          </span>
        </h2>

        <div className="mt-5 flex items-center gap-4 rounded-xl border border-line bg-bg/40 p-4">
          <div className="text-2xl">🔒</div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-sub">
              Your score
            </div>
            <div className="text-xl font-black blur-sm select-none">
              82 / 100
            </div>
          </div>
          <div className="h-12 w-px bg-line" />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-sub">
              Extra revenue · 12mo
            </div>
            <div className="text-xl font-black text-money blur-sm select-none">
              ${total.toLocaleString()}
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm">
          <Bullet>Your full Hidden Money Score (X / 100)</Bullet>
          <Bullet>Total projected extra revenue — 12-month range</Bullet>
          <Bullet>Breakdown by Retention, Throughput, and Lead capture</Bullet>
          <Bullet>Auto's personalized 90-day action plan</Bullet>
        </ul>

        {(lead.email || lead.name) && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-bg/50 px-4 py-3 text-sm">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-money/15 text-money">
              ✓
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-sub">
                We have your details
              </div>
              <div className="truncate text-ink">
                {lead.name ? `${lead.name} · ` : ""}
                {lead.email || "—"}
                {lead.shop ? ` · ${lead.shop}` : ""}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onUnlock}
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-gold px-5 py-4 text-base font-black text-[#1a1004] hover:bg-goldBright disabled:opacity-60"
        >
          {submitting ? "Unlocking…" : "Unlock my score →"}
        </button>
        <div className="mt-2 text-center text-[11px] text-sub">
          Instant — no credit card, no forms.
        </div>
      </div>

      <button
        onClick={onBack}
        className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-sub hover:text-ink"
      >
        ← Back
      </button>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 text-money">✓</span>
      <span>{children}</span>
    </li>
  );
}

// ---------- Score ----------
function ScoreScreen({
  total,
  score,
  answers,
  lead,
  connectSent,
  onConnect,
  emailResults,
  onToggleEmail,
  emailSent,
  onSendEmail,
  embed,
  onHandoff,
}: {
  total: number;
  score: number;
  answers: Record<number, AnswerRecord>;
  lead: Contact;
  connectSent: boolean;
  onConnect: () => void;
  emailResults: boolean;
  onToggleEmail: (v: boolean) => void;
  emailSent: boolean;
  onSendEmail: () => void;
  embed: boolean;
  onHandoff: () => void;
}) {
  // Group answers into 3 buckets for the breakdown card.
  const buckets = useMemo(() => {
    const groups = {
      Retention: ["Customer Retention", "Customer Trust", "Customer Comms"],
      Throughput: [
        "Shop Efficiency",
        "Throughput",
        "Tech Productivity",
        "Commitment Reliability",
        "Dream · Capacity",
      ],
      "Lead & Revenue": [
        "Recurring Revenue",
        "Lead Capture",
        "Quote → Close",
        "Upsell Conversion",
        "Parts & Procurement",
        "RO Profitability",
        "Cash Flow",
        "Pricing Awareness",
        "Your 90-Day Goal",
      ],
    };
    const result: { name: string; revenue: number }[] = [];
    for (const [name, sections] of Object.entries(groups)) {
      let sum = 0;
      for (const a of Object.values(answers)) {
        const q = QUESTIONS[a.qid];
        if (sections.includes(q.section)) {
          sum += bumpFor(q, a.optIdx);
        }
      }
      result.push({ name, revenue: sum });
    }
    return result;
  }, [answers]);

  return (
    <div className="space-y-6 animate-rise">
      <AutoBubble>
        Done. This is your number — I built it from your own answers, not a
        template. Below is the 90-day plan I'd run with you starting Monday.
      </AutoBubble>

      <div className="rounded-3xl bg-auto-grad p-6 sm:p-8 text-center shadow-2xl shadow-blue/30">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
          Hidden Money Score
        </div>
        <div className="mt-2 flex items-end justify-center gap-1 text-white">
          <span className="text-7xl sm:text-8xl font-black leading-none tabular-nums">
            {score}
          </span>
          <span className="pb-3 text-2xl font-bold opacity-80">/ 100</span>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
          🟢 Strong recovery potential
        </div>
        <div className="mt-5 rounded-2xl bg-black/30 p-4 text-white">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">
            Recoverable revenue · next 12 months
          </div>
          <div className="mt-1 text-3xl sm:text-4xl font-black tabular-nums">
            ${total.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {buckets.map((b) => (
          <div
            key={b.name}
            className="rounded-2xl border border-line bg-card p-4"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue">
              {b.name}
            </div>
            <div className="mt-1 text-2xl font-black text-money tabular-nums">
              ${b.revenue.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-sub">recovered / yr</div>
          </div>
        ))}
      </div>

      {embed ? (
        // Embed mode: parent popup owns the $1 conversion. Single
        // big-fat-button hands the user back to the funnel chrome at the
        // offer step. No connect/email surfaces here — the parent handles
        // conversion next, and email is collected upstream.
        <div className="rounded-3xl border border-gold/40 bg-gradient-to-b from-[#2b1d05] to-card p-5 sm:p-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Your fix
          </div>
          <h3 className="mt-1 text-xl sm:text-2xl font-extrabold">
            Ready to recover this revenue?
          </h3>
          <p className="mt-2 text-sub text-sm">
            I built the 90-day plan. One tap takes you back to claim it.
          </p>
          <button
            onClick={onHandoff}
            className="mt-5 w-full rounded-2xl bg-gold px-5 py-5 text-lg font-black text-[#1a1004] hover:bg-goldBright shadow-xl shadow-gold/20 active:scale-[0.98] transition-transform"
          >
            Show me how to fix this →
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gold/40 bg-gradient-to-b from-[#2b1d05] to-card p-5 sm:p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
              Auto's 90-day plan
            </div>
            <h3 className="mt-1 text-xl sm:text-2xl font-extrabold">
              Connect your shop and I'll start with the highest-ROI fix today.
            </h3>
            <p className="mt-2 text-sub text-sm">
              Auto plugs into your existing shop management software (Tekmetric,
              ShopWare, Mitchell1, AutoVitals). 10-minute setup. First wins inside
              14 days.
            </p>
            <button
              onClick={onConnect}
              disabled={connectSent}
              className="mt-5 w-full rounded-xl bg-gold px-5 py-4 text-base font-black text-[#1a1004] hover:bg-goldBright disabled:opacity-70"
            >
              {connectSent
                ? "✓ Connect request sent"
                : "Connect my shop & build my plan →"}
            </button>
          </div>

          <div className="rounded-2xl border border-line bg-card p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailResults}
                onChange={(e) => onToggleEmail(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-line bg-bg accent-blue cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-bold text-ink">
                  Email me my results
                </div>
                <div className="mt-0.5 text-sm text-sub">
                  {lead.email
                    ? `We'll send the full breakdown to ${lead.email}.`
                    : "We'll send the full breakdown to the email you used earlier."}
                </div>
              </div>
            </label>
            <button
              onClick={onSendEmail}
              disabled={!emailResults || emailSent}
              className="mt-3 w-full rounded-xl border border-blue/40 bg-blue/10 px-4 py-3 text-sm font-bold text-blue hover:bg-blue/15 disabled:opacity-60"
            >
              {emailSent ? "✓ Sent — check your inbox" : "Send my results"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
