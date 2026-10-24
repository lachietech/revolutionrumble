import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, resetCsrf } from "../api.js";
import { useAction, useResource } from "../hooks.js";
import {
  Badge,
  Confirm,
  Dialog,
  Empty,
  Field,
  Icon,
  Notice,
  PageHeader,
  Resource,
} from "../components.jsx";
import { date, idOf, number } from "../utils.js";
import { SquadPicker } from "./Register.jsx";

export function Login({ admin = false, onSuccess }) {
  const options = useResource(admin ? "/admin/email-options" : null);
  const [identity, setIdentity] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    await action.run(
      async () => {
        const body = admin
          ? { emailIndex: Number(identity) }
          : { email: identity };
        const prefix = admin ? "/admin" : "/api/bowlers";
        if (!sent) {
          await api(`${prefix}/request-otp`, { method: "POST", body });
          setSent(true);
        } else {
          await api(`${prefix}/verify-otp`, {
            method: "POST",
            body: { ...body, otp },
          });
          resetCsrf();
          if (admin) navigate("/admin/tournaments", { replace: true });
          else onSuccess();
        }
      },
      sent
        ? undefined
        : "Your six-digit code is on its way. It expires in 10 minutes.",
    );
  }
  return (
    <div className="auth-layout">
      <div className="auth-copy">
        <p className="eyebrow">
          {admin ? "Tournament control" : "Your place on the tour"}
        </p>
        <h1>
          {admin ? (
            <>
              Behind every
              <br />
              <span>great game.</span>
            </>
          ) : (
            <>
              Your game.
              <br />
              <span>Your hub.</span>
            </>
          )}
        </h1>
        <p>
          {admin
            ? "Manage events, look after your bowlers, and keep the competition moving."
            : "Your entries, your progress, your next big moment. Sign in with a secure code sent to your email."}
        </p>
        <ul className="benefits">
          {(admin
            ? [
                "Tournament and squad management",
                "Registration and payment tracking",
                "Live scoring and results",
              ]
            : [
                "Manage your upcoming entries",
                "Keep your bowler profile up to date",
                "Follow your tournament history",
              ]
          ).map((item) => (
            <li key={item}>
              <Icon name="check" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <section className="panel auth-card">
        <div className="auth-icon">
          <Icon name="user" />
        </div>
        <h2>
          {sent
            ? "Check your inbox."
            : admin
              ? "Admin sign in"
              : "Welcome to your hub."}
        </h2>
        <p>
          {sent
            ? "Enter the six-digit code we sent to your email."
            : "No password to remember. Just you and your email."}
        </p>
        <Notice message={action.message} />
        <form onSubmit={submit}>
          <fieldset disabled={action.busy}>
            <legend className="sr-only">Sign in</legend>
            {sent ? (
              <Field
                label="Verification code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength="6"
                minLength="6"
                className="otp-field"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            ) : admin ? (
              <Resource resource={options}>
                <Field label="Administrator">
                  <select
                    required
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                  >
                    <option value="">Select your account</option>
                    {options.data?.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {options.data?.options.length === 0 && (
                  <p className="notice info">
                    No admin accounts are configured. Contact the site
                    administrator.
                  </p>
                )}
              </Resource>
            ) : (
              <Field
                label="Email address"
                type="email"
                autoComplete="email"
                required
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="you@example.com"
              />
            )}
            <button
              className="button full"
              disabled={admin && !sent && !options.data?.options.length}
            >
              {action.busy
                ? "Please wait…"
                : sent
                  ? "Verify and sign in"
                  : "Send login code"}
              <Icon />
            </button>
            {sent && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setSent(false);
                  setOtp("");
                  action.setMessage(null);
                }}
              >
                Use a different account or request a new code
              </button>
            )}
          </fieldset>
        </form>
        <p className="small">
          {admin
            ? "Access is limited to authorised tournament administrators."
            : "Use the email address from your tournament registration."}
        </p>
      </section>
    </div>
  );
}

export function Hub() {
  const session = useResource("/api/bowlers/session");
  return (
    <Resource resource={session}>
      {session.data?.authenticated ? (
        <Dashboard
          key={session.data.bowlerId}
          bowlerId={session.data.bowlerId}
          onLogout={session.reload}
        />
      ) : (
        <Login onSuccess={session.reload} />
      )}
    </Resource>
  );
}

function Dashboard({ bowlerId, onLogout }) {
  const profile = useResource(`/api/bowlers/${bowlerId}`);
  const registrations = useResource("/api/bowlers/my/registrations");
  const history = useResource(`/api/bowlers/${bowlerId}/history`);
  const action = useAction();
  const [tab, setTab] = useState("entries");
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  return (
    <>
      <PageHeader
        eyebrow="Bowler Hub"
        title={`Welcome back${profile.data?.playerName ? `, ${profile.data.playerName.split(" ")[0]}` : ""}.`}
        action={
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api("/api/bowlers/logout", { method: "POST" });
                resetCsrf();
                onLogout();
              })
            }
          >
            Sign out
          </button>
        }
      >
        Your tour, all in one place.
      </PageHeader>
      <Notice message={action.message} />
      <Resource resource={profile}>
        {profile.data && (
          <div className="metric-grid panel">
            {[
              ["Tour average", profile.data.tournamentAverage],
              ["High game", profile.data.highGame],
              ["High series", profile.data.highSeries],
              ["Tournament entries", registrations.data?.length],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{number(value)}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </Resource>
      <div className="toolbar">
        <div className="tabs">
          {["entries", "profile", "history"].map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={tab === value ? "active" : ""}
            >
              {value === "entries"
                ? "My entries"
                : value === "profile"
                  ? "My profile"
                  : "Tournament history"}
            </button>
          ))}
        </div>
        <Link className="text-link" to="/events">
          Find your next event <Icon />
        </Link>
      </div>
      {tab === "profile" && (
        <Resource resource={profile}>
          {profile.data && (
            <ProfileForm
              key={profile.data.updatedAt}
              profile={profile.data}
              onSaved={() => {
                profile.reload();
                action.setMessage({ type: "success", text: "Your profile has been updated." });
              }}
            />
          )}
        </Resource>
      )}
      {tab === "entries" && (
        <Resource resource={registrations}>
          {registrations.data?.length ? (
            <div className="card-grid">
              {registrations.data.map((reg) => (
                <article className="panel" key={reg._id}>
                  <div className="section-heading">
                    <Badge tone={reg.status === "confirmed" ? "success" : ""}>
                      {reg.status}
                    </Badge>
                    <Badge>{reg.paymentStatus}</Badge>
                  </div>
                  <h2>{reg.tournament?.name || "Tournament unavailable"}</h2>
                  <p>
                    {date(reg.tournament?.startDate || reg.tournament?.date)} ·{" "}
                    {reg.tournament?.location}
                  </p>
                  <ul className="summary-list">
                    {reg.assignedSquads?.map((s) => (
                      <li key={s._id}>
                        <Icon name="calendar" />
                        {s.name} · {s.time}
                      </li>
                    ))}
                  </ul>
                  {reg.tournament?.status === "upcoming" &&
                    reg.status !== "cancelled" && (
                      <div className="actions">
                        <button
                          className="button secondary"
                          onClick={() => setEditing(reg)}
                        >
                          Change squads
                        </button>
                        <button
                          className="text-link danger-text"
                          onClick={() => setCancelling(reg)}
                        >
                          Cancel entry
                        </button>
                      </div>
                    )}
                  <Link
                    className="text-link"
                    to={`/results?tournament=${reg.tournament?._id}`}
                  >
                    View results <Icon />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Your next chapter starts on the lanes"
              action={
                <Link className="button" to="/events">
                  Explore events <Icon />
                </Link>
              }
            >
              Your tournament entries will appear here.
            </Empty>
          )}
        </Resource>
      )}
      {tab === "history" && (
        <Resource resource={history}>
          {history.data?.results?.length ? (
            <div className="table-wrap">
              <table>
                <caption>Your tournament history</caption>
                <thead>
                  <tr>
                    <th>Tournament</th>
                    <th>Place</th>
                    <th>Games</th>
                    <th>Total pins</th>
                    <th>Average</th>
                    <th>High game</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.results.map((result) => (
                    <tr key={result._id}>
                      <th scope="row">{result.tournament?.name}</th>
                      <td>{number(result.finalPosition)}</td>
                      <td>{number(result.totalGames)}</td>
                      <td>{number(result.totalPins)}</td>
                      <td>{number(result.tournamentAverage)}</td>
                      <td>{number(result.highGame)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel">
              <h2>Your results journey</h2>
              <p>
                Published tournament records will appear here. For current stage
                scores, open the results for an event below.
              </p>
              {registrations.data?.map((reg) => (
                <p key={reg._id}>
                  <Link
                    className="text-link"
                    to={`/results?tournament=${reg.tournament?._id}`}
                  >
                    {reg.tournament?.name} <Icon />
                  </Link>
                </p>
              ))}
            </div>
          )}
        </Resource>
      )}
      {editing && (
        <SquadEditor
          registration={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            registrations.reload();
          }}
        />
      )}{" "}
      {cancelling && (
        <Confirm
          title="Cancel this entry?"
          onClose={() => setCancelling(null)}
          busy={action.busy}
          onConfirm={() =>
            action.run(async () => {
              await api(`/api/registrations/${cancelling._id}/cancel`, {
                method: "DELETE",
              });
              setCancelling(null);
              registrations.reload();
            }, "Your registration has been cancelled.")
          }
        >
          <span>
            You’ll give up your place in {cancelling.tournament?.name}. Contact
            the tournament team about any payment already made.
          </span>
          <Notice message={action.message} />
        </Confirm>
      )}
    </>
  );
}

function ProfileForm({ profile, onSaved }) {
  const [form, setForm] = useState(profile);
  const action = useAction();
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  async function save(event) {
    event.preventDefault();
    await action.run(async () => {
      const body = Object.fromEntries(
        ["playerName", "nickname", "hand", "bio", "homeCenter", "gender"].map(
          (key) => [key, form[key] || ""],
        ),
      );
      for (const key of [
        "yearsExperience",
        "currentAverage",
        "highGame",
        "highSeries",
      ])
        if (form[key] !== "" && form[key] != null)
          body[key] = Number(form[key]);
      await api(`/api/bowlers/${profile._id}`, { method: "PUT", body });
      onSaved();
    }, "Your profile has been updated.");
  }
  return (
    <form className="panel" onSubmit={save}>
      <h2>Make it yours.</h2>
      <p>
        Your name, nickname, bio, and bowling statistics appear on your public
        profile.
      </p>
      <Notice message={action.message} />
      <fieldset disabled={action.busy}>
        <legend className="sr-only">Edit bowler profile</legend>
        <div className="form-grid">
          {[
            ["playerName", "Full name"],
            ["nickname", "Nickname"],
            ["homeCenter", "Home centre"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              required={key === "playerName"}
              maxLength={100}
              value={form[key] || ""}
              onChange={set(key)}
            />
          ))}
          <Field label="Bowling hand">
            <select value={form.hand || ""} onChange={set("hand")}>
              <option value="">Select hand</option>
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="both">Both</option>
            </select>
          </Field>
          {[
            ["yearsExperience", "Years bowling", 100],
            ["currentAverage", "Current average", 300],
            ["highGame", "High game", 300],
            ["highSeries", "High series (3 games)", 900],
          ].map(([key, label, max]) => (
            <Field
              key={key}
              label={label}
              type="number"
              min="0"
              max={max}
              step="1"
              value={form[key] ?? ""}
              onChange={set(key)}
            />
          ))}
          <Field label="Division">
            <select value={form.gender || ""} onChange={set("gender")}>
              <option value="">Select division</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="About you">
            <textarea
              maxLength="500"
              rows="4"
              value={form.bio || ""}
              onChange={set("bio")}
            />
          </Field>
        </div>
        <button className="button">
          {action.busy ? "Saving…" : "Save profile"}
        </button>
      </fieldset>
    </form>
  );
}

function SquadEditor({ registration, onClose, onSaved }) {
  const resource = useResource(
    `/api/tournaments/${registration.tournament._id}/squads/availability`,
  );
  const original = registration.assignedSquads.map(idOf);
  const [selected, setSelected] = useState(original);
  const action = useAction();
  return (
    <Dialog title="Change your squads" onClose={onClose}>
      <Notice message={action.message} />
      <p>
        Choose your new qualifying squads. Availability is checked when you
        save.
      </p>
      <Resource resource={resource}>
        <SquadPicker
          squads={resource.data?.squads}
          selected={selected}
          existing={original}
          onChange={setSelected}
          disabled={action.busy}
        />
        <button
          className="button"
          disabled={action.busy || !resource.data}
          onClick={() =>
            action.run(async () => {
              await api(`/api/registrations/${registration._id}/squads`, {
                method: "PUT",
                body: { assignedSquads: selected },
              });
              onSaved();
            })
          }
        >
          {action.busy ? "Saving…" : "Save squads"}
        </button>
      </Resource>
    </Dialog>
  );
}
