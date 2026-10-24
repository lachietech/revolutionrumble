import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAction, useResource } from "../hooks.js";
import {
  Badge,
  Check,
  Empty,
  Field,
  Icon,
  Notice,
  PageHeader,
  Resource,
  TournamentSelect,
} from "../components.jsx";
import { date, money, registrationState } from "../utils.js";
import { useTournamentSelection } from "./Public.jsx";

export function SquadPicker({
  squads = [],
  selected,
  onChange,
  existing = [],
  disabled = false,
}) {
  return (
    <div className="squad-options">
      {squads.map((squad) => {
        const full = squad.available <= 0 && !existing.includes(squad._id);
        return (
          <label
            key={squad._id}
            className={`squad-option ${selected.includes(squad._id) ? "selected" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(squad._id)}
              disabled={disabled || (full && !selected.includes(squad._id))}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, squad._id]
                    : selected.filter((id) => id !== squad._id),
                )
              }
            />
            <span>
              <strong>{squad.name}</strong>
              <small>
                {date(squad.date)} · {squad.time}
              </small>
            </span>
            <Badge tone={full ? "" : "success"}>
              {full
                ? "Full"
                : `${Math.max(0, squad.available ?? squad.capacity)} available`}
            </Badge>
          </label>
        );
      })}
    </div>
  );
}

export function Register() {
  const { tournaments, id, select, tournament } = useTournamentSelection();
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState(1);
  const [reservation, setReservation] = useState(null);
  const reservationRef = useRef(null);
  const [seconds, setSeconds] = useState(0);
  const [complete, setComplete] = useState(null);
  const availability = useResource(
    id ? `/api/tournaments/${id}/squads/availability` : null,
  );
  const action = useAction();
  const [details, setDetails] = useState({
    playerName: "",
    email: "",
    phone: "",
    gender: "",
    averageScore: "",
    notes: "",
  });
  useEffect(() => {
    const timer = setInterval(
      () =>
        setSeconds(
          reservation
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(reservation.expiresAt) - Date.now()) / 1000,
                ),
              )
            : 0,
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [reservation]);
  useEffect(
    () => () => {
      const held = reservationRef.current;
      if (held)
        api(`/api/reservations/${held.sessionId}`, { method: "DELETE" }).catch(
          () => {},
        );
    },
    [],
  );
  async function release() {
    const held = reservationRef.current;
    if (held)
      await api(`/api/reservations/${held.sessionId}`, { method: "DELETE" });
    reservationRef.current = null;
    setReservation(null);
  }
  async function chooseTournament(value) {
    await action.run(async () => {
      await release();
      select(value);
      setSelected([]);
      setStep(1);
      setComplete(null);
    });
  }
  const set = (key) => (event) =>
    setDetails({ ...details, [key]: event.target.value });
  const state = tournament && registrationState(tournament);
  const required = tournament?.squadsRequiredToQualify || 1;
  async function continueEntry() {
    await action.run(async () => {
      if (
        availability.data?.squads.length &&
        (selected.length < required ||
          (tournament.allowReentry === false && selected.length !== required))
      )
        throw new Error(
          `Please choose ${tournament.allowReentry === false ? "exactly" : "at least"} ${required} qualifying squad${required === 1 ? "" : "s"}.`,
        );
      const data = await api("/api/reservations", {
        method: "POST",
        body: { tournamentId: id, squads: selected },
      });
      reservationRef.current = data.reservation;
      setReservation(data.reservation);
      setSeconds(
        Math.max(
          0,
          Math.ceil((new Date(data.reservation.expiresAt) - Date.now()) / 1000),
        ),
      );
      setStep(2);
    });
  }
  async function submit(event) {
    event.preventDefault();
    await action.run(async () => {
      if (seconds <= 0)
        throw new Error(
          "Your reservation has expired. Return to squad selection to check availability.",
        );
      const result = await api("/api/registrations", {
        method: "POST",
        body: {
          ...details,
          averageScore:
            details.averageScore === "" ? null : Number(details.averageScore),
          assignedSquads: selected,
          tournamentId: id,
        },
      });
      reservationRef.current = null;
      setReservation(null);
      setComplete(result);
      setStep(3);
    });
  }
  return (
    <>
      <PageHeader title="Your next big game starts here.">
        Choose your event, pick your squads, and make it official.
      </PageHeader>
      <ol className="steps" aria-label="Registration progress">
        {["Choose your event", "Your details", "You’re on the list"].map(
          (label, i) => (
            <li
              key={label}
              className={step >= i + 1 ? "active" : ""}
              aria-current={step === i + 1 ? "step" : undefined}
            >
              <span>{step > i + 1 ? <Icon name="check" /> : `0${i + 1}`}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      <Notice message={action.message} />
      {complete ? (
        <section className="panel confirmation">
          <span className="success-symbol">
            <Icon name="check" />
          </span>
          <p className="eyebrow">Entry received</p>
          <h2>You’re on the list, {details.playerName}.</h2>
          <p>
            Your entry for <strong>{tournament?.name}</strong> has been
            received. Keep your confirmation email for your records.
          </p>
          <Badge>
            {complete.registration?.status || complete.status || "pending"}
          </Badge>
          <div className="payment-note">
            <h3>Next step: payment</h3>
            <p className="preserve-lines">
              {tournament?.paymentInstructions ||
                "The tournament team will provide payment details."}
            </p>
            <strong>{money(tournament?.entryFee)} entry fee</strong>
          </div>
          <div className="actions">
            <Link className="button" to="/bowler-hub">
              Manage your entry <Icon />
            </Link>
            <Link className="button secondary" to={`/squads?tournament=${id}`}>
              View squads
            </Link>
          </div>
        </section>
      ) : (
        <div className="split-layout">
          <div>
            <section className="panel">
              <Resource resource={tournaments}>
                <TournamentSelect
                  tournaments={(tournaments.data || []).filter(
                    (t) => t.status === "upcoming",
                  )}
                  value={id}
                  onChange={chooseTournament}
                />
              </Resource>
              {!id && (
                <Empty title="Pick your tournament">
                  Choose an upcoming event to check squad availability.
                </Empty>
              )}
              {tournament && (
                <>
                  <div className="event-summary">
                    <h2>{tournament.name}</h2>
                    <p>
                      {date(tournament.startDate || tournament.date)} ·{" "}
                      {tournament.location}
                    </p>
                    <Badge tone={state.open ? "success" : ""}>
                      {state.label}
                    </Badge>
                  </div>
                  {state.open && (
                    <Resource resource={availability}>
                      {step === 1 ? (
                        <>
                          <h3>Choose your squads</h3>
                          <p className="small">
                            {availability.data?.squads.length
                              ? `Choose ${tournament.allowReentry === false ? "exactly" : "at least"} ${required} qualifying squad${required === 1 ? "" : "s"}.`
                              : "This event does not require squad selection."}
                          </p>
                          <SquadPicker
                            squads={availability.data?.squads}
                            selected={selected}
                            onChange={setSelected}
                            disabled={action.busy}
                          />
                          <button
                            className="button"
                            disabled={action.busy || !availability.data}
                            onClick={continueEntry}
                          >
                            {action.busy
                              ? "Checking availability…"
                              : "Continue to your details"}
                            <Icon />
                          </button>
                        </>
                      ) : (
                        <form onSubmit={submit}>
                          <div
                            className={`notice ${seconds ? "info" : "error"}`}
                            role="status"
                          >
                            {seconds
                              ? `Your selection is held for ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.`
                              : "Your hold has expired. Go back to check squad availability."}
                          </div>
                          <fieldset disabled={action.busy}>
                            <legend className="sr-only">Bowler details</legend>
                            <div className="form-grid">
                              <Field
                                label="Full name"
                                required
                                minLength={2}
                                maxLength={100}
                                autoComplete="name"
                                value={details.playerName}
                                onChange={set("playerName")}
                              />
                              <Field
                                label="Email address"
                                type="email"
                                required
                                autoComplete="email"
                                value={details.email}
                                onChange={set("email")}
                              />
                              <Field
                                label="Phone number"
                                type="tel"
                                required
                                minLength={8}
                                autoComplete="tel"
                                value={details.phone}
                                onChange={set("phone")}
                              />
                              <Field label="Competition division">
                                <select
                                  value={details.gender}
                                  required
                                  onChange={set("gender")}
                                >
                                  <option value="">Choose a division</option>
                                  <option value="male">Male</option>
                                  <option value="female">Female</option>
                                </select>
                              </Field>
                              <Field
                                label="Current average"
                                type="number"
                                min="0"
                                max="300"
                                step="1"
                                value={details.averageScore}
                                onChange={set("averageScore")}
                                hint="Leave blank if you don’t have an established average."
                              />
                              <Field label="Notes (optional)">
                                <textarea
                                  rows="3"
                                  maxLength="500"
                                  value={details.notes}
                                  onChange={set("notes")}
                                />
                              </Field>
                            </div>
                            <Check
                              required
                              label="I confirm my details are correct and understand that payment is required to finalise my entry."
                            />
                            <div className="actions">
                              <button
                                className="button"
                                disabled={!seconds}
                                type="submit"
                              >
                                {action.busy
                                  ? "Submitting entry…"
                                  : "Submit registration"}
                                <Icon />
                              </button>
                              <button
                                type="button"
                                className="button secondary"
                                onClick={() =>
                                  action.run(async () => {
                                    await release();
                                    setStep(1);
                                    availability.reload();
                                  })
                                }
                              >
                                Back to squads
                              </button>
                            </div>
                          </fieldset>
                        </form>
                      )}
                    </Resource>
                  )}
                </>
              )}
            </section>
          </div>
          <aside className="panel sticky">
            <p className="eyebrow">Your tournament entry</p>
            <h2>{tournament?.name || "Ready when you are."}</h2>
            <div className="price">
              {money(tournament?.entryFee)}
              <span>entry fee</span>
            </div>
            {selected.length > 0 && (
              <ul className="summary-list">
                {selected.map((s) => (
                  <li key={s}>
                    <Icon name="check" />
                    {
                      availability.data?.squads.find((item) => item._id === s)
                        ?.name
                    }
                  </li>
                ))}
              </ul>
            )}
            <hr />
            <h3>A little good to know</h3>
            <p>
              Use the same email address for each entry to keep your tour
              history together.
            </p>
            <p>
              You can manage upcoming entries and your bowler profile in the
              Bowler Hub.
            </p>
            <Link className="text-link" to="/bowler-hub">
              Already entered? Open your hub <Icon />
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}
