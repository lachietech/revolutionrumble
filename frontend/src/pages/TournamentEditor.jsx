import { useState } from "react";
import { api } from "../api.js";
import { useAction } from "../hooks.js";
import { Check, Dialog, Field, Notice } from "../components.jsx";

const dayInput = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-CA", {
        timeZone: "Australia/Brisbane",
      })
    : "";
const localInput = (value) =>
  value
    ? new Date(new Date(value).getTime() + 10 * 3600000)
        .toISOString()
        .slice(0, 16)
    : "";
const types = [
  "qualifying",
  "round_robin",
  "tri_matchplay",
  "elimination",
  "stepladder",
];
const stageDefault = () => ({
  key: crypto.randomUUID(),
  name: "",
  type: "qualifying",
  games: 6,
  carryoverPinfall: false,
  carryoverPercentage: 100,
  advancingBowlers: null,
  description: "",
  stageConfig: {},
  matchPlaySettings: {
    pointsForWin: 30,
    pointsForTie: 15,
    pointsForLoss: 0,
    includePinfall: true,
    matchFormat: "single-game",
  },
});

export function TournamentEditor({ tournament, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    location: "",
    status: "upcoming",
    entryFee: 0,
    squadsRequiredToQualify: 1,
    allowReentry: true,
    description: "",
    paymentInstructions: "",
    ...tournament,
    startDate: dayInput(tournament.startDate || tournament.date),
    endDate: dayInput(
      tournament.endDate || tournament.startDate || tournament.date,
    ),
    registrationOpenDate: localInput(tournament.registrationOpenDate),
    registrationDeadline: localInput(tournament.registrationDeadline),
    squads: (tournament.squads || []).map((s) => ({
      ...s,
      date: dayInput(s.date),
    })),
    format: {
      gamesPerBowler: 3,
      hasStages: false,
      stages: [],
      useHandicap: false,
      handicapBase: 200,
      handicapPercentage: 90,
      separateDivisions: false,
      femaleHandicapPins: 8,
      scoringMethod: "total-pinfall",
      ...tournament.format,
      stages: (tournament.format?.stages || []).map((stage) => ({
        ...stage,
        key: stage.key || crypto.randomUUID(),
      })),
    },
  });
  const action = useAction();
  const [tab, setTab] = useState("details");
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const format = (key, value) =>
    setForm((f) => ({ ...f, format: { ...f.format, [key]: value } }));
  const stage = (index, value) =>
    format(
      "stages",
      form.format.stages.map((s, i) => (i === index ? { ...s, ...value } : s)),
    );
  const squad = (index, value) =>
    set(
      "squads",
      form.squads.map((s, i) => (i === index ? { ...s, ...value } : s)),
    );
  async function save(event) {
    event.preventDefault();
    await action.run(async () => {
      if (!form.name.trim() || !form.location.trim() || !form.startDate)
        throw new Error(
          "Name, venue, and start date are required. Check the Event details tab.",
        );
      if (form.endDate && form.endDate < form.startDate)
        throw new Error("End date must be on or after the start date.");
      if (
        form.format.hasStages &&
        (!form.format.stages.length ||
          form.format.stages.some((s) => !s.name || !s.games))
      )
        throw new Error("Add at least one named stage with a game count.");
      if (form.squads.some((s) => !s.name || !s.date || !s.time || !s.capacity))
        throw new Error("Every squad needs a name, date, time, and capacity.");
      const body = {
        ...form,
        startDate: `${form.startDate}T00:00:00+10:00`,
        endDate: `${form.endDate || form.startDate}T00:00:00+10:00`,
        maxParticipants:
          form.maxParticipants === "" || form.maxParticipants == null
            ? null
            : Number(form.maxParticipants),
        registrationOpenDate: form.registrationOpenDate
          ? `${form.registrationOpenDate}:00+10:00`
          : null,
        registrationDeadline: form.registrationDeadline
          ? `${form.registrationDeadline}:00+10:00`
          : null,
        squads: form.squads.map((s) => ({
          ...s,
          date: `${s.date}T00:00:00+10:00`,
        })),
      };
      delete body._id;
      delete body.__v;
      delete body.createdAt;
      delete body.updatedAt;
      delete body.date;
      await api(
        `/api/tournaments${tournament._id ? `/${tournament._id}` : ""}`,
        { method: tournament._id ? "PUT" : "POST", body },
      );
      onSaved();
    });
  }
  return (
    <Dialog
      title={tournament._id ? "Edit tournament" : "Create tournament"}
      onClose={() => !action.busy && onClose()}
    >
      <form onSubmit={save}>
        <Notice message={action.message} />
        <div className="tabs editor-tabs">
          {[
            ["details", "Event details"],
            ["format", "Format & stages"],
            ["squads", "Squads"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <fieldset disabled={action.busy}>
          <legend className="sr-only">Tournament editor</legend>
          {tab === "details" && (
            <>
              <div className="form-grid">
                {[
                  ["name", "Tournament name"],
                  ["location", "Venue"],
                ].map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    required
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                ))}
                <Field
                  label="Start date"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
                <Field
                  label="End date"
                  type="date"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    {["upcoming", "ongoing", "completed"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Entry fee (AUD)"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.entryFee}
                  onChange={(e) => set("entryFee", Number(e.target.value))}
                />
                <Field
                  label="Maximum participants"
                  type="number"
                  min="1"
                  value={form.maxParticipants ?? ""}
                  onChange={(e) => set("maxParticipants", e.target.value)}
                  hint="Leave blank for no overall limit."
                />
                <Field
                  label="Registration opens (Brisbane)"
                  type="datetime-local"
                  value={form.registrationOpenDate}
                  onChange={(e) => set("registrationOpenDate", e.target.value)}
                />
                <Field
                  label="Registration deadline (Brisbane)"
                  type="datetime-local"
                  value={form.registrationDeadline}
                  onChange={(e) => set("registrationDeadline", e.target.value)}
                />
                <Field
                  label="Qualifying squads required"
                  type="number"
                  min="1"
                  max="50"
                  value={form.squadsRequiredToQualify}
                  onChange={(e) =>
                    set("squadsRequiredToQualify", Number(e.target.value))
                  }
                />
              </div>
              <Check
                label="Allow additional qualifying squads (re-entry)"
                checked={form.allowReentry}
                onChange={(e) => set("allowReentry", e.target.checked)}
              />
              <Field label="Event description">
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <Field label="Payment instructions">
                <textarea
                  rows="4"
                  value={form.paymentInstructions}
                  onChange={(e) => set("paymentInstructions", e.target.value)}
                />
              </Field>
            </>
          )}
          {tab === "format" && (
            <>
              <div className="form-grid">
                <Field
                  label="Games per bowler"
                  type="number"
                  min="1"
                  max="50"
                  value={form.format.gamesPerBowler}
                  onChange={(e) =>
                    format("gamesPerBowler", Number(e.target.value))
                  }
                />
                <Field label="Scoring method">
                  <select
                    value={form.format.scoringMethod}
                    onChange={(e) => format("scoringMethod", e.target.value)}
                  >
                    {[
                      "total-pinfall",
                      "match-play",
                      "head-to-head",
                      "points",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Check
                label="Use handicap"
                checked={form.format.useHandicap}
                onChange={(e) => format("useHandicap", e.target.checked)}
              />
              {form.format.useHandicap && (
                <div className="form-grid">
                  <Field
                    label="Handicap base"
                    type="number"
                    min="0"
                    max="300"
                    value={form.format.handicapBase}
                    onChange={(e) =>
                      format("handicapBase", Number(e.target.value))
                    }
                  />
                  <Field
                    label="Handicap percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={form.format.handicapPercentage}
                    onChange={(e) =>
                      format("handicapPercentage", Number(e.target.value))
                    }
                  />
                  <Field
                    label="Female bonus pins per game"
                    type="number"
                    min="0"
                    max="100"
                    value={form.format.femaleHandicapPins}
                    onChange={(e) =>
                      format("femaleHandicapPins", Number(e.target.value))
                    }
                  />
                </div>
              )}
              <Check
                label="Separate divisions"
                checked={form.format.separateDivisions}
                onChange={(e) => format("separateDivisions", e.target.checked)}
              />
              <Check
                label="Enable bonus points"
                checked={form.format.bonusPoints?.enabled || false}
                onChange={(e) =>
                  format("bonusPoints", {
                    ...form.format.bonusPoints,
                    enabled: e.target.checked,
                  })
                }
              />
              {form.format.bonusPoints?.enabled && (
                <div className="form-grid">
                  {["perGame", "perSeries"].map((key) => (
                    <Field
                      key={key}
                      label={
                        key === "perGame"
                          ? "Bonus per game"
                          : "Bonus per series"
                      }
                      type="number"
                      min="0"
                      value={form.format.bonusPoints[key] || 0}
                      onChange={(e) =>
                        format("bonusPoints", {
                          ...form.format.bonusPoints,
                          [key]: Number(e.target.value),
                        })
                      }
                    />
                  ))}
                </div>
              )}
              <Check
                label="Use multiple tournament stages"
                checked={form.format.hasStages}
                onChange={(e) => format("hasStages", e.target.checked)}
              />
              {form.format.hasStages && (
                <>
                  {form.format.stages.map((s, i) => (
                    <section className="panel subtle" key={s.key || i}>
                      <div className="section-heading">
                        <h3>Stage {i + 1}</h3>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="text-link"
                            disabled={i === 0}
                            onClick={() => {
                              const stages = [...form.format.stages];
                              [stages[i - 1], stages[i]] = [
                                stages[i],
                                stages[i - 1],
                              ];
                              format("stages", stages);
                            }}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            className="text-link danger-text"
                            onClick={() =>
                              format(
                                "stages",
                                form.format.stages.filter(
                                  (_, index) => index !== i,
                                ),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="form-grid">
                        <Field
                          label="Stage name"
                          required
                          value={s.name}
                          onChange={(e) => stage(i, { name: e.target.value })}
                        />
                        <Field label="Stage type">
                          <select
                            value={s.type}
                            onChange={(e) => stage(i, { type: e.target.value })}
                          >
                            {types.map((v) => (
                              <option key={v} value={v}>
                                {v.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="Games / rounds"
                          type="number"
                          min="1"
                          max="50"
                          value={s.games}
                          onChange={(e) =>
                            stage(i, { games: Number(e.target.value) })
                          }
                        />
                        <Field
                          label="Bowlers advancing"
                          type="number"
                          min="1"
                          value={s.advancingBowlers ?? ""}
                          onChange={(e) =>
                            stage(i, {
                              advancingBowlers: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>
                      <Field label="Stage description">
                        <textarea
                          rows="2"
                          value={s.description || ""}
                          onChange={(e) =>
                            stage(i, { description: e.target.value })
                          }
                        />
                      </Field>
                      <Check
                        label="Carry pinfall into this stage"
                        checked={s.carryoverPinfall}
                        onChange={(e) =>
                          stage(i, { carryoverPinfall: e.target.checked })
                        }
                      />
                      {s.carryoverPinfall && (
                        <Field
                          label="Carryover percentage"
                          type="number"
                          min="0"
                          max="100"
                          value={s.carryoverPercentage ?? 100}
                          onChange={(e) =>
                            stage(i, {
                              carryoverPercentage: Number(e.target.value),
                            })
                          }
                        />
                      )}
                      <StageOptions
                        stage={s}
                        onChange={(value) => stage(i, value)}
                      />
                    </section>
                  ))}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      format("stages", [...form.format.stages, stageDefault()])
                    }
                  >
                    + Add stage
                  </button>
                </>
              )}
            </>
          )}
          {tab === "squads" && (
            <>
              <p>All squad dates and start times use Brisbane time.</p>
              {form.squads.map((s, i) => (
                <section
                  className="panel subtle"
                  key={s._id || s.clientKey || i}
                >
                  <div className="section-heading">
                    <h3>Squad {i + 1}</h3>
                    <button
                      type="button"
                      className="text-link danger-text"
                      onClick={() =>
                        set(
                          "squads",
                          form.squads.filter((_, index) => index !== i),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div className="form-grid">
                    <Field
                      label="Squad name"
                      required
                      value={s.name}
                      onChange={(e) => squad(i, { name: e.target.value })}
                    />
                    <Field
                      label="Date"
                      type="date"
                      required
                      value={s.date}
                      onChange={(e) => squad(i, { date: e.target.value })}
                    />
                    <Field
                      label="Start time"
                      type="time"
                      required
                      value={s.time}
                      onChange={(e) => squad(i, { time: e.target.value })}
                    />
                    <Field
                      label="Capacity"
                      type="number"
                      min="1"
                      required
                      value={s.capacity}
                      onChange={(e) =>
                        squad(i, { capacity: Number(e.target.value) })
                      }
                    />
                    <Field label="Stage">
                      <select
                        value={s.stageKey || ""}
                        onChange={(e) => {
                          const selected = form.format.stages.find(
                            (stage) => stage.key === e.target.value,
                          );
                          squad(i, {
                            stageKey: selected?.key || null,
                            stageName: selected?.name || "",
                            stageType: selected?.type || "qualifying",
                            isQualifying:
                              !selected || selected.type === "qualifying",
                          });
                        }}
                      >
                        <option value="">Qualifying</option>
                        {form.format.stages.map((stage, index) => (
                          <option key={stage.key || index} value={stage.key}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Check
                    label="Qualifying squad"
                    checked={s.isQualifying}
                    onChange={(e) =>
                      squad(i, { isQualifying: e.target.checked })
                    }
                  />
                </section>
              ))}
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  set("squads", [
                    ...form.squads,
                    {
                      clientKey: crypto.randomUUID(),
                      name: "",
                      date: form.startDate,
                      time: "09:00",
                      capacity: 24,
                      isQualifying: true,
                    },
                  ])
                }
              >
                + Add squad
              </button>
            </>
          )}
          <div className="editor-footer">
            <button className="button">
              {action.busy ? "Saving tournament…" : "Save tournament"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function StageOptions({ stage, onChange }) {
  const config = (key, value) =>
    onChange({ stageConfig: { ...stage.stageConfig, [key]: value } });
  const match = (key, value) =>
    onChange({
      matchPlaySettings: { ...stage.matchPlaySettings, [key]: value },
    });
  const configFields = {
    qualifying: [
      ["qualifyingSpots", "Qualifying spots"],
      ["scoresToCount", "Squad scores to count"],
    ],
    round_robin: [["positionRoundInterval", "Position round interval"]],
    tri_matchplay: [["triRounds", "Tri-matchplay rounds"]],
    elimination: [
      ["bracketSize", "Bracket size"],
      ["rounds", "Elimination rounds"],
    ],
    stepladder: [["finalists", "Finalists"]],
  };
  return (
    <>
      <div className="form-grid">
        {configFields[stage.type]?.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            type="number"
            min="0"
            value={stage.stageConfig?.[key] ?? ""}
            onChange={(e) =>
              config(key, e.target.value === "" ? null : Number(e.target.value))
            }
          />
        ))}
      </div>
      {stage.type !== "qualifying" && (
        <>
          <div className="form-grid">
            {[
              ["pointsForWin", "Win / high score", 30],
              ["pointsForTie", "Tie / middle score", 15],
              ["pointsForLoss", "Loss / low score", 0],
            ].map(([key, label, fallback]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min="0"
                max="100"
                value={stage.matchPlaySettings?.[key] ?? fallback}
                onChange={(e) => match(key, Number(e.target.value))}
              />
            ))}
            <Field label="Match format">
              <select
                value={stage.matchPlaySettings?.matchFormat || "single-game"}
                onChange={(e) => match("matchFormat", e.target.value)}
              >
                {[
                  "single-game",
                  "best-of-3",
                  "best-of-5",
                  "total-pinfall-2",
                  "total-pinfall-3",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <Check
            label="Include pinfall in matchplay standings"
            checked={stage.matchPlaySettings?.includePinfall ?? true}
            onChange={(e) => match("includePinfall", e.target.checked)}
          />
        </>
      )}
      {stage.type === "elimination" && (
        <Field label="Elimination style">
          <select
            value={stage.stageConfig?.eliminationStyle || "single"}
            onChange={(e) => config("eliminationStyle", e.target.value)}
          >
            <option value="single">Single elimination</option>
            <option value="double">Double elimination</option>
          </select>
        </Field>
      )}
      {stage.type === "stepladder" && (
        <Field
          label="Seeding notes"
          value={stage.stageConfig?.seedingNote || ""}
          onChange={(e) => config("seedingNote", e.target.value)}
        />
      )}
    </>
  );
}
