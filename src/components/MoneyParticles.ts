// Spawn $/💰/🔧 particles around a target element on choice events.
// Pure DOM — no React state needed. Cleans up its own nodes.

const ICONS = ["$", "💰", "🔧", "$"];

export function burstFrom(target: HTMLElement, count = 14) {
  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "wf-particle";
    el.textContent = ICONS[i % ICONS.length];
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = -(80 + Math.random() * 180);
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    el.style.setProperty("--dx0", "0px");
    el.style.setProperty("--dy0", "0px");
    el.style.fontSize = `${14 + Math.random() * 10}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
}
