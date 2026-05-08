# WrenchFlow Auto · Paywall Onboarding

10-question diagnostic quiz that funnels independent auto-shop owners into a paywalled "Shop Profit Score" reveal, then offers to connect their shop and build a 90-day plan with **Auto** (the WrenchFlow AI co-pilot).

Lives at `wrenchflow.com/auto`. Mirrors the PestFlow Revenue Accelerator pattern — money-line ticker, particle bursts on selection, blurred score behind paywall, signature blue→cyan gradient on reveal.

## Repo layout

```
index.html                                           # the wireframe (vanilla HTML/CSS/JS, ~1200 lines)
wrenchflow-logo.png                                  # brand icon used in the topbar
supabase/
  config.toml                                        # Supabase CLI project config
  migrations/
    20260507120000_create_quiz_submissions.sql      # quiz_submissions table + RLS
  functions/
    quiz-submission/
      index.ts                                       # Deno Edge Function (POST handler)
```

## Wiring the front end to the backend

The HTML reads its API URL and anon key from `window` globals so the same file can run locally or behind the prod Supabase project. Set them in a small inline script before `index.html`'s main script tag (or via your host's edge config):

```html
<script>
  window.WRENCHFLOW_AUTO_API = "https://<your-project-ref>.supabase.co/functions/v1/quiz-submission";
  window.WRENCHFLOW_AUTO_ANON_KEY = "<your-anon-key>";
</script>
```

If neither is set, the quiz still runs end-to-end and queues submissions to `localStorage` under `wrenchflow.auto.queue` so nothing is lost while the backend is offline.

## Deploy the backend

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Link to your hosted project
supabase login
supabase link --project-ref <your-project-ref>

# 2. Push the migration
supabase db push

# 3. Deploy the Edge Function
supabase functions deploy quiz-submission --no-verify-jwt
```

The function pulls `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Edge runtime — both are auto-injected on Supabase, no extra secrets needed.

## What the front end POSTs

```jsonc
{
  "sessionId": "uuid",            // stable per-browser, regenerated if cleared
  "intent": "submit" | "connect", // submit = unlocked score, connect = clicked CTA on score screen
  "contact": { "name": "...", "email": "...", "shop": "..." },
  "answers": [ { "qid": "retention", "label": "65–75%", "revBump": 28000 } ],
  "revenue": 188000,              // running money-line total at submission time
  "score": 76,                    // computed Shop Profit Score
  "durationMs": 142331,
  "userAgent": "Mozilla/..."
}
```

Server clamps numeric fields, truncates oversize strings, and inserts one row per call. Returns `{ id, intent }`.

## Local testing

```bash
supabase start                   # boots Postgres + edge runtime locally
supabase functions serve quiz-submission --no-verify-jwt
# then in another shell:
python3 -m http.server 7831      # serve index.html
# open http://localhost:7831/index.html
```

## Roadmap

- Wire the Cal-AI-style screen layout for the per-question reveal (separate task — pending after the question battery is final)
- Pipe submissions into a Slack/email digest for the WrenchFlow founder
- Hook `intent: "connect"` rows to the Auto onboarding queue
