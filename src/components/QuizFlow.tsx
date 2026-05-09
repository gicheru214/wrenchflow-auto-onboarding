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
import { identifyAuditUser, trackFunnel } from "../lib/tracking";
import AutoBubble from "./AutoBubble";
import MoneyLine from "./MoneyLine";
import Topbar from "./Topbar";
import Toast, { ToastKind } from "./Toast";
import { burstFrom } from "./MoneyParticles";

type Step = "intro" | number | "paywall" | "calculating" | "score";

// Questions that get an interstitial AutoBubble break screen *before*
// they render. Picked at the section transitions where the user
// has just finished a heavy block (after Q4 capacity, after Q13 cash flow).
const INTERSTITIAL_BEFORE = new Set<number>([3, 12]);

export default function QuizFlow() {
  // Embed mode = audit is being hosted inside the upstream popup iframe.
  // Skip the local intro screen and the built-in paywall; the parent funnel
  // already showed an intro card and owns the $1 conversion that follows.
  const embed = useMemo(() => isEmbedMode(), []);
  const [step, setStep] = useState<Step>(embed ? 0 : "intro");
  const [answers, setAnswers] = useState<Record<number, AnswerRecord>>({});
  // Tracks which interstitial break screens (Q4, Q13) the user has dismissed.
  const [seenBreaks, setSeenBreaks] = useState<Set<number>>(() => new Set());
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

  // Identify the user to Mixpanel/PostHog as soon as the audit boots
  // — the upstream funnel already captured the email, so the audit
  // events should land on the same person profile, not anonymous ids.
  useEffect(() => {
    if (lead.email) {
      identifyAuditUser(lead.email, {
        name: lead.name,
        shop: lead.shop,
        audit_session_id: getSessionId(),
        audit_embed_mode: embed,
      });
    }
    trackFunnel("funnel_audit_loaded", {
      embed_mode: embed,
      session_id: getSessionId(),
      has_lead: Boolean(lead.email),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step transitions — fire one event per screen the user lands on.
  useEffect(() => {
    const sid = getSessionId();
    if (step === "intro") {
      trackFunnel("funnel_audit_intro_shown", { session_id: sid });
    } else if (step === "paywall") {
      trackFunnel("funnel_audit_paywall_shown", {
        session_id: sid,
        revenue: total,
      });
    } else if (step === "calculating") {
      trackFunnel("funnel_audit_calculating_shown", {
        session_id: sid,
        revenue: total,
        score,
      });
    } else if (step === "score") {
      trackFunnel("funnel_audit_score_revealed", {
        session_id: sid,
        revenue: total,
        score,
      });
    } else if (typeof step === "number") {
      const q = QUESTIONS[step];
      const isInterstitial =
        INTERSTITIAL_BEFORE.has(step) && !seenBreaks.has(step);
      trackFunnel(
        isInterstitial
          ? "funnel_audit_interstitial_shown"
          : "funnel_audit_question_shown",
        {
          session_id: sid,
          qid: step,
          q_number: step + 1,
          section: q.section,
          revenue: total,
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, seenBreaks]);

  const stepLabel =
    step === "intro"
      ? "Intro"
      : step === "paywall"
        ? "Paywall"
        : step === "calculating"
          ? "Calculating"
          : step === "score"
            ? "Score reveal"
            : `Q${(step as number) + 1}`;
  const stepCount =
    step === "intro"
      ? `0 / ${QUESTIONS.length}`
      : step === "paywall"
        ? `${QUESTIONS.length} / ${QUESTIONS.length}`
        : step === "calculating"
          ? "…"
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
    const q = QUESTIONS[qid];
    const bump = bumpFor(q, optIdx);
    trackFunnel("funnel_audit_question_answered", {
      session_id: getSessionId(),
      qid,
      q_number: qid + 1,
      section: q.section,
      opt_idx: optIdx,
      opt_label: q.opts[optIdx],
      rev_bump: bump,
      running_total: total + bump,
    });
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
    // Drop into the "Calculating your hidden money map" screen first —
    // gives the network call cover and lets the score reveal land hard.
    go("calculating");
    const [result] = await Promise.all([
      postSubmission(payload),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
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

        {typeof step === "number" &&
          (INTERSTITIAL_BEFORE.has(step) && !seenBreaks.has(step) ? (
            <Interstitial
              qid={step}
              total={total}
              onContinue={() =>
                setSeenBreaks((s) => new Set(s).add(step as number))
              }
            />
          ) : (
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
          ))}

        {step === "calculating" && <CalculatingScreen />}

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
          💰 Shop Hidden Money Finder
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
          diagnostic independent shop owners use to find{" "}
          <strong className="text-money">$30K–$80K</strong> of recoverable
          revenue every year.
        </p>
      </div>

      <ColdOpenDemo />

      <button
        onClick={onStart}
        className="block w-full rounded-2xl bg-auto-grad px-5 py-4 text-base font-extrabold text-white shadow-xl shadow-blue/20 transition-transform active:scale-[0.98]"
      >
        Start the diagnostic →
      </button>
      <div className="text-center text-[11px] uppercase tracking-[0.18em] text-sub">
        No signup · No card · Result in 3 min
      </div>
    </div>
  );
}

// 6-second looping cold-open: shows a fake question being answered,
// money line ticking up, and Auto's bubble landing — gives the user a
// preview of the quiz feel before they commit to starting.
function ColdOpenDemo() {
  const beats = [
    {
      section: "Throughput",
      q: "How often is a bay sitting empty?",
      pick: "A few hours adds up",
      bubble: "That's bay-hours bleeding $115/hr in pure capacity.",
      delta: 7000,
      total: 7000,
    },
    {
      section: "Lead Capture",
      q: "Calls after 7pm?",
      pick: "Voicemail — I call back tomorrow",
      bubble: "After-hours intent is the #1 leak I see.",
      delta: 14000,
      total: 21000,
    },
    {
      section: "Recurring Revenue",
      q: "Tracking next-due services?",
      pick: "Stickers + hope",
      bubble: "Each missed interval = $295 walking down the road.",
      delta: 10000,
      total: 31000,
    },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % beats.length), 2200);
    return () => clearInterval(t);
  }, [beats.length]);
  const beat = beats[idx];

  return (
    <div className="rounded-3xl border border-blue/30 bg-gradient-to-b from-[#0c1a2c] to-card p-4 sm:p-5 shadow-xl shadow-blue/10">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue">
          Live preview · how Auto runs
        </div>
        <div className="flex gap-1">
          {beats.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-4 rounded-full transition-colors ${
                i === idx ? "bg-blue" : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>

      <div key={`mini-${idx}`} className="mt-3 wf-cold-fade">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
          {beat.section}
        </div>
        <div className="mt-0.5 text-sm sm:text-base font-extrabold text-ink leading-snug">
          {beat.q}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-blue bg-blue/10 px-3 py-2 text-[12.5px] font-semibold text-ink">
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-blue bg-blue">
            <span className="h-1 w-1 rounded-full bg-bg" />
          </span>
          <span className="flex-1">{beat.pick}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3 rounded-lg border border-money/30 bg-money/5 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-money/80">
            Money Line
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs font-extrabold text-money tabular-nums wf-cold-delta">
              +${beat.delta.toLocaleString()}
            </span>
            <span className="text-lg font-black text-money tabular-nums">
              ${beat.total.toLocaleString()}
            </span>
          </span>
        </div>
        <div className="mt-2 rounded-lg border border-line bg-card/60 px-3 py-2 text-[12px] text-sub">
          <span className="font-bold text-blue">Auto:</span> {beat.bubble}
        </div>
      </div>

      <style>{`
        @keyframes wf-cold-fade-kf {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wf-cold-delta-kf {
          0%   { opacity: 0; transform: translateY(4px) scale(0.9); }
          25%  { opacity: 1; transform: translateY(-1px) scale(1.1); }
          80%  { opacity: 1; transform: translateY(-1px) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.95); }
        }
        .wf-cold-fade { animation: wf-cold-fade-kf 420ms ease-out both; }
        .wf-cold-delta {
          animation: wf-cold-delta-kf 1.6s ease-out both;
          text-shadow: 0 0 10px rgba(74, 222, 128, 0.55);
        }
      `}</style>
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
                style={{ animationDelay: `${i * 60}ms` }}
                className={`wf-opt flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13px] font-semibold transition-[transform,background,border] duration-150 active:scale-[0.97] hover:scale-[1.005] ${
                  picked
                    ? "border-blue bg-blue/10 text-ink ring-2 ring-blue/30"
                    : "border-line bg-card hover:border-blue/40 hover:bg-card/70 text-ink"
                }`}
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors ${
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
        <style>{`
          @keyframes wf-opt-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .wf-opt {
            animation: wf-opt-in 360ms ease-out both;
          }
        `}</style>
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
  // 18 individual tick segments. Each one fills the moment its
  // question becomes the current step — gives a discrete, mile-marker
  // sense of forward motion (Cal AI / Mobbin pattern).
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[11px] uppercase tracking-[0.18em] text-sub">
        <span>
          Question {qid + 1} of {QUESTIONS.length}
        </span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div
        className="flex w-full gap-[3px]"
        role="progressbar"
        aria-valuenow={qid + 1}
        aria-valuemax={QUESTIONS.length}
      >
        {Array.from({ length: QUESTIONS.length }).map((_, i) => {
          const filled = i <= qid;
          const isCurrent = i === qid;
          return (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                filled
                  ? isCurrent
                    ? "bg-gradient-to-r from-gold to-blue shadow-[0_0_10px_rgba(245,166,35,0.55)]"
                    : "bg-blue/80"
                  : "bg-line"
              }`}
            />
          );
        })}
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
          <CountUp
            to={score}
            duration={1600}
            className="text-7xl sm:text-8xl font-black leading-none tabular-nums"
          />
          <span className="pb-3 text-2xl font-bold opacity-80">/ 100</span>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
          🟢 Strong recovery potential
        </div>
        <div className="mt-5 rounded-2xl bg-black/30 p-4 text-white">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">
            Recoverable revenue · next 12 months
          </div>
          <CountUp
            to={total}
            duration={1800}
            prefix="$"
            className="mt-1 block text-3xl sm:text-4xl font-black tabular-nums"
          />
        </div>
      </div>

      <LeakBars buckets={buckets} />

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

// ---------- Interstitial (Q4 / Q13 break screens) ----------
function Interstitial({
  qid,
  total,
  onContinue,
}: {
  qid: number;
  total: number;
  onContinue: () => void;
}) {
  // Two break beats — one halfway through, one before the back half's
  // money questions. Auto acknowledges what they've shared and gives
  // them a breath before the next stretch.
  const copy =
    qid === 3
      ? {
          tag: "Quick reset",
          title: "Through 3 — 15 to go.",
          body: (
            <>
              I'm already seeing the shape of your shop's leak — and you've
              barely told me anything. The next four are about{" "}
              <strong className="text-blue">throughput and revenue</strong>.
              That's where most of the recoverable money is hiding.
            </>
          ),
          cta: "Keep going →",
        }
      : {
          tag: "Last stretch",
          title: "Five questions left. These are the tell.",
          body: (
            <>
              You've already surfaced{" "}
              <strong className="text-money">
                ${total.toLocaleString()}
              </strong>{" "}
              of recoverable revenue. The next five are about{" "}
              <strong className="text-blue">cash, pricing, and trust</strong>{" "}
              — usually the biggest single jumps on the board.
            </>
          ),
          cta: "Show me the rest →",
        };

  return (
    <div className="space-y-4 animate-rise pb-24">
      <div className="rounded-2xl border border-blue/30 bg-gradient-to-b from-[#0c1a2c] to-card p-5 sm:p-6 shadow-xl shadow-blue/10">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue">
          {copy.tag}
        </div>
        <h2 className="mt-1 text-xl sm:text-2xl font-extrabold leading-tight">
          {copy.title}
        </h2>
        <AutoBubble>
          <p>{copy.body}</p>
        </AutoBubble>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat
            label="So far"
            value={`Q${qid} / ${QUESTIONS.length}`}
            tone="neutral"
          />
          <Stat
            label="Money line"
            value={`$${total.toLocaleString()}`}
            tone="ok"
          />
          <Stat
            label="Time left"
            value={qid === 3 ? "~2 min" : "~1 min"}
            tone="neutral"
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={onContinue}
            className="rounded-lg bg-auto-grad px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-blue/20"
          >
            {copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "ok";
}) {
  return (
    <div className="rounded-lg border border-line bg-card/70 px-2 py-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-sub">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-black tabular-nums ${
          tone === "ok" ? "text-money" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ---------- Calculating screen (2.5s before score reveal) ----------
function CalculatingScreen() {
  const lines = [
    "Reading your 18 answers…",
    "Cross-checking industry benchmarks…",
    "Tagging each leak by section…",
    "Building your 90-day recovery plan…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1 >= lines.length ? i : i + 1)),
      600,
    );
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div className="space-y-6 pt-6 sm:pt-12 animate-rise">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue/30 bg-blue/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue">
          🧮 Auto is calculating
        </div>
        <h1 className="mt-5 text-2xl sm:text-4xl font-black leading-[1.05] tracking-tight">
          Calculating your hidden
          <br />
          <span className="bg-auto-grad bg-clip-text text-transparent">
            money map…
          </span>
        </h1>
      </div>

      <div className="mx-auto grid w-full max-w-md place-items-center gap-5">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-line" />
          <div className="absolute inset-0 rounded-full border-4 border-blue border-t-transparent animate-spin" />
          <div className="absolute inset-0 grid place-items-center text-2xl">
            💰
          </div>
        </div>
        <ul className="grid w-full gap-2">
          {lines.map((l, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                i <= idx
                  ? "border-money/30 bg-money/5 text-ink"
                  : "border-line bg-card/40 text-sub opacity-60"
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${
                  i < idx
                    ? "bg-money text-bg"
                    : i === idx
                      ? "bg-blue text-white animate-pulse"
                      : "bg-line text-sub"
                }`}
              >
                {i < idx ? "✓" : "•"}
              </span>
              <span className="flex-1">{l}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- Count-up + LeakBars (used by ScoreScreen) ----------
function CountUp({
  to,
  duration = 1400,
  prefix = "",
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  className?: string;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(to * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return (
    <span className={className}>
      {prefix}
      {v.toLocaleString()}
    </span>
  );
}

function LeakBars({
  buckets,
}: {
  buckets: { name: string; revenue: number }[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.revenue));
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue">
        Where the money is hiding
      </div>
      <div className="mt-3 grid gap-3">
        {buckets.map((b, i) => {
          const pct = drawn ? Math.round((b.revenue / max) * 100) : 0;
          return (
            <div key={b.name}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-ink">{b.name}</span>
                <span className="text-sm font-black tabular-nums text-money">
                  $<CountUp to={b.revenue} duration={1400} />
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-money"
                  style={{
                    width: `${pct}%`,
                    transition: `width 1.1s cubic-bezier(0.22, 1, 0.36, 1) ${i * 180}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
