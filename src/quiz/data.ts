// 18-question Shop Profit Diagnostic — same battery as the wireframe,
// now consumed by the React quiz flow.

export interface Question {
  section: string;
  autoIntro: string;
  text: string;
  opts: string[];
  /** Industry-average context shown after the user answers. HTML allowed. */
  avg: string;
  /** Personalized hit / loss math. HTML allowed. */
  hit: string;
  /** Auto's plan / coaching line for this dimension. */
  goal: string;
  /** Dollar value added to the running money line on selection. */
  revBump: number;
}

export const QUESTIONS: Question[] = [
  {
    section: "Customer Retention",
    autoIntro:
      "Let's start with the customers you've already earned. Hardest dollars to win — easiest dollars to lose.",
    text: "How many regular customers stopped coming back in the last 90 days?",
    opts: ["0–2", "3–6", "7–12", "13–20", "21+"],
    avg: "Independent shops typically lose 8–12% of their active customer base per year — most without ever hearing why.",
    hit: "Each lost regular is worth <strong>$1,400–$2,800/yr</strong> in repair + maintenance LTV. You're likely bleeding <strong>$8K–$25K/yr</strong> in silent churn.",
    goal: "Here's what we'll do together: turn that bleed into a list. The shops that win year 2 don't get more customers — they keep the ones they have.",
    revBump: 22000,
  },
  {
    section: "Customer Retention",
    autoIntro: "Knowing the number is step one. Knowing why is where the money is.",
    text: "When a regular stops coming back, do you know why?",
    opts: [
      "No idea — they just disappear",
      "I sometimes find out at the counter",
      "I track it informally",
      "Yes, every cancel reason logged + acted on",
    ],
    avg: "67% of lost-customer reasons are recoverable: price surprise, slow turnaround, or no follow-up after the last big repair.",
    hit: "Recovering even <strong>1 in 4</strong> with a 7-day cancel-save flow is worth <strong>$6K–$18K/yr</strong> per bay.",
    goal: "Auto can listen to your customers for you — text, voicemail, review tone — and tell you exactly which ones are about to ghost. Before they do.",
    revBump: 14000,
  },
  {
    section: "Shop Efficiency",
    autoIntro: "Now let's talk about your time — the one input you can't buy more of.",
    text: "How many hours/week do you or your service writer spend on quotes, scheduling, parts callbacks, and follow-ups?",
    opts: ["Under 6 hrs", "6–12 hrs", "13–20 hrs", "21–30 hrs", "30+ hrs"],
    avg: "The average independent shop loses 14–22 hrs/week to manual estimate-and-followup loops. That's ~3 wrenching hours per day, gone.",
    hit: "At $95/hr door rate, those hours = <strong>$60K–$110K/yr</strong> in unbillable admin time you're subsidizing yourself.",
    goal: "Imagine those hours back on the floor — or back at home. Auto handles the busywork: digital inspections, parts ETA pings, follow-up texts. You wrench.",
    revBump: 38000,
  },
  {
    section: "Throughput",
    autoIntro: "Empty bays don't pay rent. Let's see how often yours sit cold.",
    text: "On a busy day, how often is a bay sitting empty waiting for a part, an approval, or the next car?",
    opts: [
      "Almost never — we flow",
      "Once or twice",
      "A few hours adds up",
      "Half the day, honestly",
      "It's the bottleneck",
    ],
    avg: "Most shops run at 58–72% bay utilization. The top quartile runs 84–91% — same techs, same square footage.",
    hit: "Each idle bay-hour at $145 effective labor = <strong>$30K–$60K/yr per bay</strong> in pure capacity left on the table.",
    goal: "Auto's job here is to never let a bay go cold without telling you why. Real-time dispatch, parts ETA, digital approval — bays move, money moves.",
    revBump: 48000,
  },
  {
    section: "Recurring Revenue",
    autoIntro:
      "Every car that left your shop today is due for something in the next 6 months. Most shops never tell them.",
    text: "How are you tracking when a customer is due for next oil, brakes, timing belt, or 60K service?",
    opts: [
      "Honestly, I rely on them remembering",
      "Stickers + hope",
      "A spreadsheet I update sometimes",
      "Calendar reminders, mostly",
      "Automated mileage + interval texts",
    ],
    avg: "Without automation, shops capture only 32–41% of service-interval re-bookings. Top operators hit 68%+.",
    hit: "Missing 6 due-services per week × $385 average ticket = <strong>$120K/yr</strong> walking to the chain shop down the road.",
    goal: "We're going to flip this. Auto pulls mileage from your DVI history, predicts the next 3 services, and texts the customer for you the week before. You just confirm the appointment.",
    revBump: 62000,
  },
  {
    section: "Lead Capture",
    autoIntro:
      "When the bay door closes, the phone keeps ringing. Let's see what happens to those calls.",
    text: "Someone calls at 7pm with a check-engine light. What happens?",
    opts: [
      "Voicemail — I call back tomorrow",
      "Goes to my cell, I get it when I get it",
      "Answering service takes a name",
      "AI answers, books the slot, sends confirm",
    ],
    avg: "46% of automotive emergency calls happen outside 8–5. Shops that answer or auto-book within 5 minutes close 4–8× more of them.",
    hit: "One missed tow-eligible job = <strong>$650–$1,400</strong>. Ten missed/month = <strong>$78K–$168K/yr</strong> in unanswered intent.",
    goal: "Auto answers the phone in your voice, qualifies the job, books the bay, and texts you the details before you finish dinner. You wake up with a full Tuesday.",
    revBump: 92000,
  },
  {
    section: "Quote → Close",
    autoIntro:
      "Now the moment of truth. You diagnosed the car, sent the estimate. Then what?",
    text: "When you send a digital inspection or estimate, what % do customers approve same-day?",
    opts: ["Under 30%", "30–45%", "46–60%", "61–75%", "75%+"],
    avg: "Industry average DVI close rate is 38–48%. Shops with photo + video evidence + payment-plan offers hit 65–78%.",
    hit: "Lifting close rate from 45% → 65% on a $40K/mo ticket book adds <strong>$96K/yr</strong> with zero new leads.",
    goal: "Auto turns every estimate into a guided story: photo of the part, 30-second tech video, payment options, instant approval link. Customers say yes faster — and bigger.",
    revBump: 56000,
  },
  {
    section: "Customer Trust",
    autoIntro:
      "Trust is the hidden multiplier. Customers who feel known buy more, refer more, never leave.",
    text: 'When a customer asks "when did you last do my brakes?" — how long does it take to find?',
    opts: [
      "10+ minutes (or I can't)",
      "A few minutes digging",
      "Under a minute from the system",
      "Instant — they pull it themselves in their app",
    ],
    avg: "Customers who can self-serve their service history refer at 2.4× the rate of customers who can't.",
    hit: "Each happy referral = <strong>$1,800 LTV</strong>. Trust friction quietly costs <strong>$15K–$40K/yr</strong> in word-of-mouth you're not getting.",
    goal: "Auto builds every customer their own little dashboard: history, photos, what's coming up. They become repeat customers who feel like members.",
    revBump: 18000,
  },
  {
    section: "Dream · Capacity",
    autoIntro: "Now let's dream a little. This is your shop at full power.",
    text: "If every bay turned 1.5 more cars/day with no extra labor or hours, how much extra monthly revenue would that mean?",
    opts: [
      "Under $6K/mo",
      "$6K–$12K/mo",
      "$12K–$25K/mo",
      "$25K–$50K/mo",
      "$50K+/mo",
    ],
    avg: "1.5 extra cars × $385 ticket × 22 days × 3 bays = <strong>$38,115/mo</strong> in pure throughput unlock.",
    hit: "Auto-equipped shops hit a <strong>17–26%</strong> bay-throughput lift in the first 60 days. No new techs. No new building.",
    goal: "This is your real number. Not from new customers — from the cars already in your lot today. The win is mechanical: less waiting, more wrenching.",
    revBump: 38000,
  },
  {
    section: "Your 90-Day Goal",
    autoIntro:
      "Last one of the core set. This is the one you'll come back to in 90 days to see if I delivered.",
    text: "In the next 90 days, what would have to be true for Auto to be worth 5× what you pay?",
    opts: [
      "Save me 10+ hrs/week",
      "Recover lost regulars",
      "Capture every after-hours lead",
      "Double my estimate close rate",
      "All of the above",
    ],
    avg: "Shop owners who name their 5× outcome on day one hit it 3.4× more often than those who don't.",
    hit: "The shops that import 90 days of RO history on day one see <strong>$8K–$15K of recovered revenue</strong> in the first 30 days alone.",
    goal: "Got it. I'll pin this goal to your dashboard and check in every Friday with the receipts.",
    revBump: 0,
  },
  // ---------- New S/A-tier battery ----------
  {
    section: "Parts & Procurement",
    autoIntro: "Quick one. Parts is where the morning gets eaten alive — let's measure it.",
    text: "On a typical mid-complexity job, how many parts stores are you (or your writer) calling to get the right part at the right price?",
    opts: ["Just 1 — I have my go-to", "2 stores", "3 stores", "4+ stores, every time"],
    avg: "Independent shops average 2.7 calls per job. Each call burns 6–11 minutes of writer time and 18–35 minutes of bay-idle time waiting on confirmation.",
    hit: "At 14 jobs/week × 2.7 calls × 9 min = <strong>5.6 hrs/week</strong> on the phone — and ~$11K/yr of cold bays waiting on parts ETA.",
    goal: "Auto checks live availability across your top 6 suppliers in one shot, picks the best landed cost, and pings you when it ships. Phone tag dies on day one.",
    revBump: 11000,
  },
  {
    section: "RO Profitability",
    autoIntro: "Now the question most owners flinch at. No judgment — almost nobody knows the answer.",
    text: "Out of your last 10 repair orders, do you know — by name — which one made you the most money?",
    opts: [
      "Honestly, no",
      "I could guess but not prove it",
      "I track gross profit on a spreadsheet",
      "Yes — by-RO margin in real time",
    ],
    avg: "78% of independent shop owners can't name their highest-margin RO from last week. Half can't name it from yesterday.",
    hit: "Without per-RO margin, you're re-quoting your worst jobs and under-pricing your best. The hidden cost: <strong>$24K–$70K/yr</strong> in mispriced repeat work.",
    goal: "Auto tags every RO with parts margin, labor margin, and effective $/bay-hr the moment it closes. You'll know your money jobs and your loss leaders by Friday.",
    revBump: 32000,
  },
  {
    section: "Tech Productivity",
    autoIntro: "Same shape of question, different muscle. This one's about your people.",
    text: "Can you tell me right now, with an actual number, your most efficient vs your least efficient tech?",
    opts: [
      "No clue — I go by feel",
      "I have a hunch but no number",
      "I look at flagged hours sometimes",
      "Yes — I have weekly proficiency by tech",
    ],
    avg: "The gap between top-quartile and bottom-quartile techs in the same shop is typically <strong>34–58% in flagged-hour productivity</strong>. Most owners never see it.",
    hit: "A 1.0-hour/day swing per tech × 3 techs × $145 effective = <strong>$95K/yr</strong> in invisible labor leakage.",
    goal: "Auto scoreboards every tech weekly — billed hrs vs clocked hrs, comeback rate, average ticket. The conversation moves from 'I think' to 'here's the number.'",
    revBump: 42000,
  },
  {
    section: "Cash Flow",
    autoIntro: "OK — this is the question I save for the owners I really want to help. Take your best honest shot.",
    text: "Right now, how much money is sitting in your accounts receivable — uncollected work that's already done?",
    opts: ["Under $5K", "$5K–$15K", "$15K–$40K", "$40K–$100K", "$100K+", "Honestly, I'm not sure"],
    avg: 'The median independent shop carries $18K–$32K in AR — fleet, warranty, and "I\'ll pay you Friday" tickets. ~40% of owners can\'t answer this within $10K.',
    hit: "Every $1 in AR over 30 days has a ~12% chance of never being collected. Aged AR = <strong>$3K–$28K/yr</strong> in silent write-offs.",
    goal: "Auto shows you AR aged by week, by customer, with a one-tap nudge — text, email, or auto-charge a card on file. Cash flow stops being a mystery.",
    revBump: 24000,
  },
  {
    section: "Pricing Awareness",
    autoIntro: "Speed round. Don't overthink it — first instinct.",
    text: "What's a single bay-hour worth to your shop, all-in?",
    opts: ["$130", "$150", "$180", "Above $180", "Honestly, I haven't calculated that"],
    avg: "A loaded bay-hour (rent, utilities, tech burden, equipment amortization) costs $74–$96 to operate. The average shop sells it at $115 — leaving 18–28% on the table.",
    hit: "Underpricing your bay-hour by even $20 across 28 billable hrs/wk × 50 wks = <strong>$28K/yr per bay</strong> you're donating to your customers.",
    goal: "Auto runs a quarterly bay-hour audit: your real cost, your competitor band, your effective realized rate. Pricing stops being a guess.",
    revBump: 26000,
  },
  {
    section: "Upsell Conversion",
    autoIntro: "OK — this one's the tell. Most owners are off by 50% on this number, in the optimistic direction.",
    text: "Out of every 10 digital inspections you send with recommended work, how many close that same day?",
    opts: ["0–2", "3–4", "5–6", "7–8", "9–10"],
    avg: "Industry honest answer is 2–4 of 10. Shops with photo + 30-second tech video + payment-plan link clear 6–8 of 10.",
    hit: "Lifting same-day DVI close from 3 → 6 on a $40K/mo book = <strong>$144K/yr</strong> in already-diagnosed work that wasn't walking out the door.",
    goal: "Auto turns each DVI into a sellable story: short video, before/after photo, financing in 1 tap. Same-day approval becomes the default, not the exception.",
    revBump: 48000,
  },
  {
    section: "Commitment Reliability",
    autoIntro: "This one's about trust — the kind customers measure with their watch, not with words.",
    text: 'When you tell a customer "your car will be ready by 3," how often does it actually slip?',
    opts: [
      "Daily — it's the norm",
      "A few times a week",
      "Maybe once a week",
      "Rarely — we hit our promises",
    ],
    avg: "63% of shops slip on stated promise time more than once per day. Customers forgive twice — by the third miss, they leave a review and never come back.",
    hit: "Each chronic-slip customer churns at 2.1× the normal rate. Promise-miss churn quietly costs <strong>$22K–$58K/yr</strong> in LTV.",
    goal: "Auto auto-texts the real ETA the moment it shifts — '20 min late, here's why' beats silence every time. Promise misses stop costing you the customer.",
    revBump: 22000,
  },
  {
    section: "Customer Comms",
    autoIntro: "Last one of this batch. How you deliver the news matters more than what the news is.",
    text: "When you find extra work mid-job, how do you usually tell the customer?",
    opts: [
      "Phone call",
      "They're in the lobby — I walk over",
      "Text message",
      "Paper or printed estimate",
      "It depends — no consistent way",
    ],
    avg: "Voice calls hit a 41% same-shift approval rate. Text-with-photo hits 67%. Paper hits 22%. Mixed/no-system shops hit whatever the moon does that day.",
    hit: "Switching the default channel from phone to photo-text on extra-work upsells lifts approval ~26 points — <strong>$32K–$74K/yr</strong> in already-found work.",
    goal: "Auto sends a photo-and-video text the moment your tech flags extra work — customer taps approve, you start wrenching. No more hold music.",
    revBump: 28000,
  },
];
