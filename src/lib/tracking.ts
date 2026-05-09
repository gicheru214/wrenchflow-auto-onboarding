// Audit-funnel tracking — mirrors the wrenchflow-main `trackFunnel`
// pattern so events from the audit subdomain land in the same
// Mixpanel project under the `Funnel: …` namespace.
//
// Events use `funnel_audit_*` snake_case (PostHog) and get rewritten
// to `Funnel: Audit …` Title Case for Mixpanel.

declare global {
  interface Window {
    mixpanel?: {
      track: (event: string, properties?: Record<string, unknown>) => void;
      identify?: (id: string) => void;
      people?: { set?: (props: Record<string, unknown>) => void };
    };
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify?: (id: string, props?: Record<string, unknown>) => void;
    };
  }
}

const mp = () => (typeof window !== "undefined" ? window.mixpanel : undefined);
const ph = () => (typeof window !== "undefined" ? window.posthog : undefined);

const toMixpanelName = (snake: string): string => {
  if (!snake.startsWith("funnel_")) return snake;
  const rest = snake.slice("funnel_".length).split("_");
  const titled = rest
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return `Funnel: ${titled}`;
};

export const trackFunnel = (
  event: string,
  properties?: Record<string, unknown>,
) => {
  try {
    mp()?.track(toMixpanelName(event), properties);
  } catch {
    /* swallow */
  }
  try {
    ph()?.capture(event, properties);
  } catch {
    /* swallow */
  }
};

export const identifyAuditUser = (
  email: string,
  properties?: Record<string, unknown>,
) => {
  try {
    mp()?.identify?.(email);
    mp()?.people?.set?.({ $email: email, ...properties });
  } catch {
    /* swallow */
  }
  try {
    ph()?.identify?.(email, { email, ...properties });
  } catch {
    /* swallow */
  }
};
