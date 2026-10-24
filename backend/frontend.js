import express from "express";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { requireAdmin } from "./middleware/auth.js";

const root = path.resolve(import.meta.dirname, "..");
const aliases = {
  "/index.html": "/",
  "/register.html": "/register",
  "/events.html": "/events",
  "/results.html": "/results",
  "/squads.html": "/squads",
  "/bowlerstats.html": "/player-stats",
  "/bowlerstats": "/player-stats",
  "/playerstats": "/player-stats",
  "/bowler-hub.html": "/bowler-hub",
  "/admin-login.html": "/admin/login",
  "/admin-tournaments.html": "/admin/tournaments",
  "/admin-registrations.html": "/admin/registrations",
  "/admin-results.html": "/admin/results",
  "/admin/admin-email-templates.html": "/admin/email-templates",
  "/admin": "/admin/tournaments",
};

export function mountFrontend(app, developmentMiddleware) {
  app.get("/admin/logout", (req, res) =>
    res.status(404).send({ error: "Use POST to sign out" }),
  );
  app.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method)) return next();
    const target = aliases[req.path];
    if (target)
      return res.redirect(
        301,
        target +
          (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""),
      );
    if (req.path === "/results" && req.query.tab === "stats")
      return res.redirect(301, "/player-stats");
    next();
  });
  app.use("/admin", (req, res, next) =>
    req.path === "/login" ? next() : requireAdmin(req, res, next),
  );
  if (developmentMiddleware) app.use(developmentMiddleware);
  else {
    app.use(
      express.static(path.join(root, "dist"), { index: false, maxAge: "1h" }),
    );
    app.get("*", (req, res) => {
      if (path.extname(req.path))
        return res.status(404).send({ error: "File not found" });
      const entry = path.join(root, "dist/index.html");
      if (!existsSync(entry))
        return res
          .status(503)
          .send(
            "Frontend build missing. Run npm run build, or npm run dev for development.",
          );
      res.set("Cache-Control", "no-cache");
      return res.sendFile(entry);
    });
  }
}

export async function createDevelopmentFrontend() {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  const router = express.Router();
  router.use(vite.middlewares);
  router.get("*", async (req, res, next) => {
    try {
      if (path.extname(req.path))
        return res.status(404).send({ error: "File not found" });
      const html = await vite.transformIndexHtml(
        req.originalUrl,
        readFileSync(path.join(root, "frontend/index.html"), "utf8"),
      );
      res.status(200).type("html").send(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  });
  return { middleware: router, close: () => vite.close() };
}
