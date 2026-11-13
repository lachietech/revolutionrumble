// Dependency-free ES module. Safe to import during server-side rendering.
export function createVisitPulse({ endpoint, username, enabled = true } = {}) {
  let memorySession;
  let started = false;
  const sessionKey = `visitpulse.session.${username}`;
  function getSessionId() {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (/^[A-Za-z0-9_-]{16,64}$/.test(saved || "")) return saved;
    } catch { /* Storage may be disabled. */ }
    memorySession ||= crypto.randomUUID().replaceAll("-", "");
    try { sessionStorage.setItem(sessionKey, memorySession); } catch { /* Use memory. */ }
    return memorySession;
  }
  async function trackPageView({ path, title } = {}) {
    if (!enabled || typeof window === "undefined") return false;
    if (navigator.globalPrivacyControl || navigator.doNotTrack === "1") return false;
    try {
      if (!/^[a-z0-9._-]{3,32}$/.test(username || "")) return false;
      const url = new URL(endpoint, location.origin);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
      const response = await fetch(url.href, {
        method: "POST", credentials: "omit", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username, sessionId: getSessionId(),
          path: (path || location.pathname).split(/[?#]/, 1)[0].slice(0, 300),
          title: String(title ?? document.title).slice(0, 160),
          referrer: document.referrer ? new URL(document.referrer).origin : "",
        }),
      });
      return response.ok;
    } catch { return false; }
  }
  function start() {
    if (started || typeof window === "undefined") return;
    started = true;
    if (document.readyState === "complete") void trackPageView();
    else window.addEventListener("load", () => void trackPageView(), { once: true });
  }
  return { start, trackPageView };
}
