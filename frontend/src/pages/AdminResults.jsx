import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useAction, useResource } from "../hooks.js";
import {
  Badge,
  Confirm,
  Empty,
  Field,
  Notice,
  PageHeader,
  Resource,
  Search,
  TournamentSelect,
} from "../components.jsx";
import { number, stagesOf } from "../utils.js";
import { useTournamentSelection } from "./Public.jsx";
import {
  buildStageDraw,
  getStageGameCount,
  getPlayerMatchups,
  getHandicapPerGame,
  includesPinfall,
} from "../../../shared/scoring.js";

export function AdminResults() {
  const { tournaments, id, select, tournament } = useTournamentSelection();
  const resource = useResource(
    id ? `/api/registrations?tournamentId=${id}` : null,
  );
  const [stageIndex, setStageIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [squad, setSquad] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [dirty, setDirty] = useState({});
  const action = useAction();
  useEffect(() => {
    setRegistrations(resource.data || []);
    setDirty({});
  }, [resource.data]);
  const hasUnsaved = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    const guardLink = (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (anchor && anchor.origin === location.origin && anchor.pathname !== location.pathname) {
        event.preventDefault();
        action.setMessage({ type: "error", text: "Save or reset edited scores before leaving the scoring desk." });
      }
    };
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [hasUnsaved]);
  const stages = stagesOf(tournament);
  const stage = stages[stageIndex] || stages[0];
  const active = registrations.filter((r) =>
    ["pending", "confirmed"].includes(r.status),
  );
  const entrants = active.filter(
    (r) =>
      (r.currentStage || 0) === stageIndex ||
      r.stageScores?.some((s) => s.stageIndex === stageIndex),
  );
  const draw = buildStageDraw(stage, entrants, stageIndex, active, tournament);
  const games = getStageGameCount(stage, entrants.length, draw);
  const visible = draw.seededPlayers.filter(
    (r) =>
      r.playerName.toLowerCase().includes(query.toLowerCase()) &&
      (!squad || r.assignedSquads?.includes(squad)),
  );
  const eligible = entrants.filter((r) => (r.currentStage || 0) === stageIndex);
  const complete =
    eligible.length > 0 &&
    eligible.every(
      (r) =>
        (r.stageScores?.find((s) => s.stageIndex === stageIndex)?.scores
          .length || 0) >= games,
    );
  async function advance() {
    await action.run(async () => {
      if (hasUnsaved || !complete)
        throw new Error(
          "Save all scores and complete every bowler’s games before advancing.",
        );
      await api(`/api/tournaments/${id}/advance`, {
        method: "POST",
        body: { stageIndex },
      });
      setConfirm(false);
      resource.reload();
    }, "Qualified players advanced to the next stage.");
  }
  return (
    <>
      <PageHeader eyebrow="Scoring desk" title="Bring the results to life.">
        Record game scores, review standings, and progress the tournament.
      </PageHeader>
      <Notice message={action.message} />
      <Resource resource={tournaments}>
        <div className="toolbar">
          <TournamentSelect
            tournaments={tournaments.data}
            value={id}
            onChange={(value) => {
              if (hasUnsaved) {
                action.setMessage({
                  type: "error",
                  text: "Save or reset your edited scores before switching tournaments.",
                });
                return;
              }
              select(value);
              setStageIndex(0);
              setSquad("");
            }}
          />
          {hasUnsaved && <Badge tone="warning">Unsaved scores</Badge>}
          {id && <button className="button secondary" disabled={hasUnsaved || action.busy} onClick={resource.reload}>Refresh scores</button>}
        </div>
      </Resource>
      {!id ? (
        <Empty title="Ready for the first frame">
          Choose a tournament to manage its scores.
        </Empty>
      ) : (
        <Resource resource={resource}>
          <div className="toolbar">
            <div className="tabs">
              {stages.map((s, i) => (
                <button
                  key={i}
                  className={i === stageIndex ? "active" : ""}
                  onClick={() => {
                    if (hasUnsaved) {
                      action.setMessage({
                        type: "error",
                        text: "Save or reset edited scores before changing stages.",
                      });
                      return;
                    }
                    setStageIndex(i);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <Search
              value={query}
              onChange={(value) => {
                if (!hasUnsaved) setQuery(value);
              }}
            />
          </div>
          {tournament?.squads?.length > 0 && (
            <Field label="Filter squad">
              <select
                value={squad}
                disabled={hasUnsaved}
                onChange={(e) => setSquad(e.target.value)}
              >
                <option value="">All squads</option>
                {tournament.squads.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <p className="small">
            {stage.type.replaceAll("_", " ")} · {games} games ·{" "}
            {entrants.length} bowlers. A score of 0 is valid; leave unplayed
            games blank. Save each bowler’s row when ready.
          </p>
          {visible.length ? (
            <div className="table-wrap scoring-table">
              <table>
                <caption>
                  {tournament?.name} · {stage.name}
                </caption>
                <thead>
                  <tr>
                    <th>Bowler</th>
                    {Array.from({ length: games }, (_, i) => (
                      <th key={i}>G{i + 1}</th>
                    ))}
                    <th>Total</th>
                    <th>Average</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((reg) => (
                    <ScoreRow
                      key={`${id}-${stageIndex}-${reg._id}`}
                      registration={reg}
                      tournament={tournament}
                      stage={stage}
                      stageIndex={stageIndex}
                      games={games}
                      matchups={getPlayerMatchups(draw, reg._id)}
                      onDirty={(value) =>
                        setDirty((current) => ({
                          ...current,
                          [reg._id]: value,
                        }))
                      }
                      onSaved={(updated) =>
                        setRegistrations((current) =>
                          current.map((r) =>
                            r._id === updated._id ? updated : r,
                          ),
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No bowlers in this view">
              Check your filters, or advance bowlers from the previous stage.
            </Empty>
          )}
          {stageIndex < stages.length - 1 && stage.advancingBowlers > 0 && (
            <section className="panel advance-panel">
              <div>
                <h2>Next up: {stages[stageIndex + 1].name}</h2>
                <p>
                  Advance the top {stage.advancingBowlers} bowlers after every
                  game is complete.
                </p>
              </div>
              <button
                className="button"
                disabled={hasUnsaved || !complete || action.busy}
                onClick={() => setConfirm(true)}
              >
                Review advancement
              </button>
            </section>
          )}
          {confirm && (
            <Confirm
              title={`Advance the top ${stage.advancingBowlers}?`}
              onClose={() => setConfirm(false)}
              onConfirm={advance}
              busy={action.busy}
            >
              <span>
                Rankings include saved pinfall, handicap, match bonuses, and
                carryover. Ties at the cut must be resolved first.
              </span>
              <Notice message={action.message} />
            </Confirm>
          )}
        </Resource>
      )}
    </>
  );
}

export function ScoreRow({
  registration,
  tournament,
  stage,
  stageIndex,
  games,
  matchups = [],
  onDirty,
  onSaved,
}) {
  const existing = registration.stageScores?.find(
    (s) => s.stageIndex === stageIndex,
  );
  const [scores, setScores] = useState(() =>
    Array.from({ length: games }, (_, i) => existing?.scores?.[i] ?? ""),
  );
  const [bonuses, setBonuses] = useState(() =>
    Array.from({ length: games }, (_, i) => existing?.bonusPins?.[i] ?? 0),
  );
  const [dirty, setDirty] = useState(false);
  const action = useAction();
  const ref = useRef(null);
  const format = tournament.format || {};
  const handicap = getHandicapPerGame(tournament, registration);
  const matchSettings = stage.matchPlaySettings ||
    format.matchPlay || {
      pointsForWin: 30,
      pointsForTie: 15,
      pointsForLoss: 0,
    };
  const isMatch = stage.type !== "qualifying" || (format.scoringMethod && format.scoringMethod !== "total-pinfall");
  const played = scores.filter((s) => s !== "");
  const scratch = played.reduce((sum, score) => sum + Number(score), 0);
  const bonusTotal = scores.reduce(
    (sum, score, i) => sum + (score === "" ? 0 : Number(bonuses[i])),
    0,
  );
  const total =
    (includesPinfall(tournament, stageIndex) ? scratch + handicap * played.length : 0) +
    bonusTotal +
    (existing?.carryover || 0);
  const mark = () => {
    setDirty(true);
    onDirty(true);
    action.setMessage(null);
  };
  async function save() {
    const invalid = [...ref.current.querySelectorAll("input")].find(
      (input) => !input.checkValidity(),
    );
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    await action.run(async () => {
      const last = scores.findLastIndex((score) => score !== "");
      if (scores.slice(0, last + 1).some((score) => score === ""))
        throw new Error(
          "Fill earlier games before saving a later game. Blank games cannot shift score positions.",
        );
      const result = await api(`/api/registrations/${registration._id}`, {
        method: "PUT",
        body: {
          stageScores: {
            stageIndex,
            scores: scores.slice(0, last + 1).map(Number),
            bonusPins: bonuses.slice(0, last + 1).map(Number),
            handicap,
          },
        },
      });
      setDirty(false);
      onDirty(false);
      onSaved(result);
    }, "Saved");
  }
  return (
    <tr ref={ref} className={dirty ? "is-dirty" : ""}>
      <th scope="row">
        {registration.playerName}
        {handicap > 0 && (
          <small className="block muted">+{handicap} per game</small>
        )}
        {existing?.carryover > 0 && (
          <small className="block muted">Carry: {existing.carryover}</small>
        )}
      </th>
      {scores.map((score, index) => (
        <td key={index}>
          {matchups[index] && (
            <small className="opponent" title={matchups[index].label}>
              {matchups[index].opponentName}
            </small>
          )}
          <input
            className="score-input"
            type="number"
            min="0"
            max="300"
            step="1"
            placeholder="—"
            aria-label={`${registration.playerName} game ${index + 1}`}
            value={score}
            disabled={action.busy}
            onChange={(e) => {
              const next = [...scores];
              next[index] = e.target.value;
              setScores(next);
              mark();
            }}
          />
          {isMatch && (
            <select
              className="bonus-input"
              aria-label={`${registration.playerName} game ${index + 1} bonus`}
              value={bonuses[index]}
              disabled={action.busy}
              onChange={(e) => {
                const next = [...bonuses];
                next[index] = Number(e.target.value);
                setBonuses(next);
                mark();
              }}
            >
              {[
                ...new Set([
                  0,
                  matchSettings.pointsForWin ?? 30,
                  matchSettings.pointsForTie ?? 15,
                  matchSettings.pointsForLoss ?? 0,
                  bonuses[index],
                ]),
              ].map((value) => (
                <option key={value} value={value}>
                  {value === 0
                    ? "No bonus"
                    : value === matchSettings.pointsForWin
                      ? `Win +${value}`
                      : value === matchSettings.pointsForTie
                        ? `Tie +${value}`
                        : `+${value}`}
                </option>
              ))}
            </select>
          )}
        </td>
      ))}
      <td className="accent strong">{number(total)}</td>
      <td>{played.length ? (scratch / played.length).toFixed(1) : "—"}</td>
      <td>
        <button
          className="button small"
          disabled={!dirty || action.busy}
          onClick={save}
        >
          {action.busy ? "Saving…" : "Save"}
        </button>
        {dirty && (
          <button
            className="text-link small"
            onClick={() => {
              setScores(
                Array.from(
                  { length: games },
                  (_, i) => existing?.scores?.[i] ?? "",
                ),
              );
              setBonuses(
                Array.from(
                  { length: games },
                  (_, i) => existing?.bonusPins?.[i] ?? 0,
                ),
              );
              setDirty(false);
              onDirty(false);
            }}
          >
            Reset
          </button>
        )}
        <Notice message={action.message} />
      </td>
    </tr>
  );
}
