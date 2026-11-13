import { createVisitPulse } from "./visitpulse-tracker.js";

const pageTitles = {
  "/": "Home",
  "/events": "Events",
  "/register": "Registration",
  "/squads": "Squads",
  "/results": "Results",
  "/player-stats": "Player stats",
  "/bowler-hub": "Bowler Hub",
  "/admin/login": "Admin login",
  "/admin/tournaments": "Admin tournaments",
  "/admin/registrations": "Admin registrations",
  "/admin/results": "Admin scoring",
  "/admin/email-templates": "Admin emails",
};

export function createNavigationAnalytics(config) {
  const tracker = createVisitPulse({
    ...config,
    enabled: Boolean(config.endpoint && config.username),
  });
  let previousPath;
  return ({ pathname, search = "" }) => {
    // Redirect routes are recorded only when their destination renders.
    if (["/admin", "/playerstats", "/bowlerstats"].includes(pathname)) return;
    if (pathname === "/results" && new URLSearchParams(search).get("tab") === "stats") return;
    // Ignore query/filter changes and repeated React effect setup.
    if (previousPath === pathname) return;
    previousPath = pathname;
    const path = /^\/events\/[^/]+\/?$/.test(pathname)
      ? "/events/:id"
      : Object.hasOwn(pageTitles, pathname) ? pathname : "/not-found";
    const title = path === "/events/:id" ? "Tournament" : pageTitles[path] || "Page not found";
    return tracker.trackPageView({ path, title: `${title} | Revolution Rumble` });
  };
}

// One tracker per browser application; the route effect owns the initial view.
export const trackNavigation = createNavigationAnalytics({
  endpoint: import.meta.env?.VITE_VISITPULSE_ENDPOINT,
  username: import.meta.env?.VITE_VISITPULSE_USERNAME,
});
