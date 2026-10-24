import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStageDraw, getStageScoreTotal } from "../shared/scoring.js";
import { planAdvancement } from "../backend/utils/advancement.js";
import { registrationState } from "../frontend/src/utils.js";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import session from 'express-session';
import { createApp } from '../backend/app.js';
import { createDevelopmentFrontend } from '../backend/frontend.js';

test("React event cards escape stored HTML instead of creating executable markup", async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  try {
    const { EventCard } = await vite.ssrLoadModule("/src/components.jsx");
    const payload = "<img src=x onerror=alert(1)>";
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(EventCard, {
          event: {
            _id: "test",
            name: payload,
            description: payload,
            location: payload,
            status: "upcoming",
            startDate: "2099-01-01",
          },
        }),
      ),
    );
    assert.ok(html.includes("&lt;img"));
    assert.ok(!html.includes("<img src=x"));
  } finally {
    await vite.close();
  }
});

test("round-robin draws schedule every opponent once for even and odd fields", () => {
  for (const count of [4, 5]) {
    const players = Array.from({ length: count }, (_, index) => ({
      _id: String(index),
      playerName: `Bowler ${index}`,
    }));
    const draw = buildStageDraw({ type: "round_robin" }, players, 0);
    assert.equal(draw.games, count - 1);
    for (const player of players) {
      const matches = draw.matchupsByPlayer.get(player._id);
      assert.equal(matches.length, count - 1);
      assert.equal(new Set(matches.map((m) => m.opponentName)).size, count - 1);
      assert.ok(!matches.some((m) => m.opponentName === player.playerName));
    }
  }
});

const tournament = {
  format: {
    hasStages: true,
    stages: [
      { name: "Qualifying", type: "qualifying", games: 3, advancingBowlers: 1 },
      {
        name: "Final",
        type: "qualifying",
        games: 3,
        carryoverPinfall: true,
        carryoverPercentage: 0,
      },
    ],
  },
};
const player = (id, scores, extra = {}) => ({
  _id: id,
  playerName: id,
  status: "confirmed",
  currentStage: 0,
  stageScores: [
    {
      stageIndex: 0,
      scores,
      handicap: 10,
      bonusPins: [0, 30, 0],
      carryover: 100,
    },
  ],
  ...extra,
});

test("advancement counts zero-score games, handicap, bonuses and carryover, and honours zero percent carryover", () => {
  const rows = [player("A", [0, 200, 220]), player("B", [100, 100, 100])];
  assert.equal(getStageScoreTotal(rows[0], 0), 580);
  const plan = planAdvancement(tournament, rows, 0);
  assert.equal(plan[0].registrationId, "A");
  assert.equal(plan[0].currentStage, 1);
  assert.equal(plan[0].stageScores[1].carryover, 0);
});

test("advancement rejects incomplete fields, cut-line ties, and repeat advancement", () => {
  assert.throws(
    () =>
      planAdvancement(
        tournament,
        [player("A", [200, 200, 200]), player("B", [100])],
        0,
      ),
    /Complete/,
  );
  assert.throws(
    () =>
      planAdvancement(
        tournament,
        [player("A", [200, 200, 200]), player("B", [200, 200, 200])],
        0,
      ),
    /tie/,
  );
  assert.throws(
    () =>
      planAdvancement(
        tournament,
        [player("A", [200, 200, 200], { currentStage: 1 })],
        0,
      ),
    /already advanced/,
  );
});

test('points-only matchplay omits scratch and handicap from ranking totals', () => {
  const tournament = { format: { hasStages: true, useHandicap: true, handicapBase: 200, handicapPercentage: 0, stages: [{ type: 'round_robin', matchPlaySettings: { includePinfall: false } }] } };
  assert.equal(getStageScoreTotal(player('A', [300, 300, 300]), 0, tournament), 130);
  const draw = buildStageDraw({ type: 'tri_matchplay', games: 3, stageConfig: { triRounds: 8 } }, [], 0);
  assert.equal(draw.games, 8);
});

test("registration state honours manual closure and deadlines even when manually opened", () => {
  const now = Date.parse("2026-10-24T00:00:00Z");
  assert.equal(registrationState({ status: "upcoming" }, now).open, true);
  assert.equal(
    registrationState(
      {
        status: "upcoming",
        registrationManuallyOpened: true,
        registrationManuallyClosed: true,
      },
      now,
    ).open,
    false,
  );
  assert.equal(
    registrationState(
      {
        status: "upcoming",
        registrationManuallyOpened: true,
        registrationDeadline: "2026-10-23",
      },
      now,
    ).open,
    false,
  );
  assert.equal(
    registrationState(
      { status: "upcoming", registrationOpenDate: "2026-10-25" },
      now,
    ).open,
    false,
  );
});

test('development middleware serves React and deep links on the Express origin', async () => {
  const frontend = await createDevelopmentFrontend();
  const server = createApp({ store: new session.MemoryStore(), sessionSecret: 'dev-fixture-secret-with-at-least-32-characters', frontendMiddleware: frontend.middleware }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base + '/events');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /@vite\/client/);
    const module = await fetch(base + '/src/main.jsx');
    assert.equal(module.status, 200);
    assert.match(await module.text(), /createRoot/);
    assert.equal((await fetch(base + '/api/no-such-endpoint')).status, 404);
  } finally {
    await frontend.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
