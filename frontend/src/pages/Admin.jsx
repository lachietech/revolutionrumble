import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAction, useResource } from "../hooks.js";
import {
  Badge,
  Check,
  Confirm,
  Dialog,
  Empty,
  Field,
  Icon,
  Notice,
  PageHeader,
  Resource,
  Search,
  TournamentSelect,
} from "../components.jsx";
import { date, exportCsv, idOf, money, registrationState } from "../utils.js";
import { useTournamentSelection } from "./Public.jsx";
import { TournamentEditor } from "./TournamentEditor.jsx";

export function AdminTournaments() {
  const resource = useResource("/api/tournaments");
  const action = useAction();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const events = (resource.data || []).filter((t) =>
    `${t.name} ${t.location}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="Tournament management"
        title="Set the stage."
        action={
          <button className="button" onClick={() => setEditing({})}>
            + New tournament
          </button>
        }
      >
        Plan events, build your formats, and open the lanes to your bowlers.
      </PageHeader>
      <Notice message={action.message} />
      <div className="toolbar">
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Search tournaments…"
        />
        <span className="muted">{events.length} tournaments</span>
      </div>
      <Resource resource={resource}>
        {events.length ? (
          <div className="table-wrap">
            <table>
              <caption>Your tournaments</caption>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Registration</th>
                  <th>Entry fee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((t) => (
                  <tr key={t._id}>
                    <th scope="row">
                      {t.name}
                      <small className="block muted">{t.location}</small>
                    </th>
                    <td>{date(t.startDate || t.date)}</td>
                    <td>
                      <Badge tone={t.status === "ongoing" ? "live" : ""}>
                        {t.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={registrationState(t).open ? "success" : ""}>
                        {registrationState(t).label}
                      </Badge>
                    </td>
                    <td>{money(t.entryFee)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button small secondary"
                          onClick={() => setEditing(t)}
                        >
                          Edit
                        </button>
                        <Link
                          className="text-link"
                          to={`/admin/results?tournament=${t._id}`}
                        >
                          Scoring
                        </Link>
                        <button
                          className="text-link"
                          disabled={action.busy || t.status !== "upcoming"}
                          onClick={() =>
                            action.run(async () => {
                              await api(
                                `/api/tournaments/${t._id}/${registrationState(t).open ? "close" : "open"}-registration`,
                                { method: "POST" },
                              );
                              resource.reload();
                            }, "Registration availability updated.")
                          }
                        >
                          {registrationState(t).open
                            ? "Close entries"
                            : "Open entries"}
                        </button>
                        <button
                          className="text-link danger-text"
                          onClick={() => setDeleting(t)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={query ? "No tournaments match" : "Build your next event"}
            action={
              !query && (
                <button className="button" onClick={() => setEditing({})}>
                  Create tournament
                </button>
              )
            }
          >
            {query
              ? "Try another name or venue."
              : "Create a tournament, add your squads, and get ready to rumble."}
          </Empty>
        )}
      </Resource>
      {editing && (
        <TournamentEditor
          tournament={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            resource.reload();
            action.setMessage({ type: "success", text: "Tournament saved." });
          }}
        />
      )}{" "}
      {deleting && (
        <Confirm
          title="Delete this tournament?"
          busy={action.busy}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            action.run(async () => {
              await api(`/api/tournaments/${deleting._id}`, {
                method: "DELETE",
              });
              setDeleting(null);
              resource.reload();
            }, "Tournament deleted.")
          }
        >
          <span>Delete {deleting.name}? This action cannot be undone.</span>
          <Notice message={action.message} />
        </Confirm>
      )}
    </>
  );
}

export function AdminRegistrations() {
  const { tournaments, id, select } = useTournamentSelection();
  const resource = useResource(
    `/api/registrations${id ? `?tournamentId=${id}` : ""}`,
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [notes, setNotes] = useState(null);
  const action = useAction();
  const rows = (resource.data || []).filter(
    (r) =>
      `${r.playerName} ${r.email}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!status || status === r.status) &&
      (!payment || payment === r.paymentStatus),
  );
  const eventFor = (row) =>
    tournaments.data?.find((t) => t._id === idOf(row.tournament)) ||
    row.tournament;
  const squadNames = (row) =>
    (eventFor(row)?.squads || [])
      .filter((s) => row.assignedSquads?.map(idOf).includes(s._id))
      .map((s) => s.name)
      .join(", ");
  const update = (row, path, body) =>
    action.run(async () => {
      await api(`/api/registrations/${row._id}${path}`, {
        method: "PUT",
        body,
      });
      resource.reload();
    }, "Registration updated.");
  return (
    <>
      <PageHeader
        eyebrow="Registration management"
        title="Look after your field."
        action={
          <button
            className="button secondary"
            disabled={!rows.length}
            onClick={() =>
              exportCsv(
                "rumble-registrations.csv",
                [
                  "Name",
                  "Email",
                  "Phone",
                  "Tournament",
                  "Squads",
                  "Average",
                  "Status",
                  "Payment",
                  "Notes",
                ],
                rows.map((r) => [
                  r.playerName,
                  r.email,
                  r.phone,
                  eventFor(r)?.name,
                  squadNames(r),
                  r.averageScore,
                  r.status,
                  r.paymentStatus,
                  r.notes,
                ]),
              )
            }
          >
            Export CSV
          </button>
        }
      >
        Track entries, confirm payments, and keep everyone ready to bowl.
      </PageHeader>
      <Notice message={action.message} />
      <Resource resource={tournaments}>
        <div className="toolbar">
          <TournamentSelect
            tournaments={tournaments.data}
            value={id}
            onChange={select}
            all
          />
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Search name or email…"
          />
          <Field label="Entry status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {["pending", "confirmed", "waitlist", "cancelled"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment">
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="">All payments</option>
              {["unpaid", "deposit", "paid"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
      </Resource>
      <Resource resource={resource}>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <caption>{rows.length} registrations</caption>
              <thead>
                <tr>
                  <th>Bowler</th>
                  <th>Tournament / squads</th>
                  <th>Average</th>
                  <th>Entry status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <th scope="row">
                      {row.playerName}
                      <small className="block muted">{row.email}</small>
                      <small className="block muted">{row.phone}</small>
                    </th>
                    <td>
                      {eventFor(row)?.name}
                      <small className="block muted">
                        {squadNames(row) || "No squads assigned"}
                      </small>
                    </td>
                    <td>{row.averageScore ?? "—"}</td>
                    <td>
                      <select
                        aria-label={`Entry status for ${row.playerName}`}
                        value={row.status}
                        disabled={action.busy}
                        onChange={(e) =>
                          update(row, "", { status: e.target.value })
                        }
                      >
                        {["pending", "confirmed", "waitlist", "cancelled"].map(
                          (v) => (
                            <option key={v}>{v}</option>
                          ),
                        )}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Payment for ${row.playerName}`}
                        value={row.paymentStatus || "unpaid"}
                        disabled={action.busy}
                        onChange={(e) =>
                          update(row, "/payment-status", {
                            paymentStatus: e.target.value,
                          })
                        }
                      >
                        {["unpaid", "deposit", "paid"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="text-link"
                          onClick={() =>
                            setNotes({
                              id: row._id,
                              name: row.playerName,
                              text: row.notes || "",
                            })
                          }
                        >
                          Notes
                        </button>
                        <button
                          className="text-link danger-text"
                          onClick={() => setDeleting(row)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No registrations found">
            Entries matching your filters will appear here.
          </Empty>
        )}
      </Resource>
      {deleting && (
        <Confirm
          title="Delete this registration?"
          busy={action.busy}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            action.run(async () => {
              await api(`/api/registrations/${deleting._id}`, {
                method: "DELETE",
              });
              setDeleting(null);
              resource.reload();
            }, "Registration deleted.")
          }
        >
          <span>
            This permanently removes the entry for {deleting.playerName},
            including its recorded scores.
          </span>
          <Notice message={action.message} />
        </Confirm>
      )}
      {notes && (
        <Dialog title={`Notes · ${notes.name}`} onClose={() => setNotes(null)}>
          <Notice message={action.message} />
          <Field label="Registration notes">
            <textarea
              rows="5"
              maxLength="500"
              value={notes.text}
              onChange={(e) => setNotes({ ...notes, text: e.target.value })}
            />
          </Field>
          <button
            className="button"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api(`/api/registrations/${notes.id}`, {
                  method: "PUT",
                  body: { notes: notes.text },
                });
                setNotes(null);
                resource.reload();
              }, "Notes saved.")
            }
          >
            Save notes
          </button>
        </Dialog>
      )}
    </>
  );
}

const defaultTemplate = {
  subject: "Your entry for {{tournamentName}}",
  htmlBody:
    "<h1>You’re on the list, {{bowlerName}}!</h1>\n<p>{{tournamentName}} · {{tournamentDate}}</p>\n<p>{{tournamentLocation}}</p>\n<p>Squads: {{squadsList}}</p>\n<p>Entry fee: ${{entryFee}}</p>\n<p>{{paymentInstructions}}</p>\n<p>Reference: {{registrationId}}</p>",
  textBody:
    "Hi {{bowlerName}},\nYour entry for {{tournamentName}} is received.\n{{tournamentDate}} · {{tournamentLocation}}\nSquads: {{squadsList}}\nEntry fee: ${{entryFee}}\n{{paymentInstructions}}\nReference: {{registrationId}}",
};
export function AdminEmails() {
  const resource = useResource("/api/email-templates");
  return (
    <>
      <PageHeader eyebrow="Email management" title="A great first impression.">
        Create the confirmation bowlers receive when they enter a tournament.
      </PageHeader>
      <Resource resource={resource}>
        {resource.data && (
          <EmailEditor
            template={
              resource.data.find(
                (t) => t.name === "registration-confirmation",
              ) || defaultTemplate
            }
          />
        )}
      </Resource>
    </>
  );
}
function EmailEditor({ template }) {
  const [form, setForm] = useState(template);
  const [preview, setPreview] = useState(null);
  const action = useAction();
  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(
          () =>
            api("/api/email-templates/registration-confirmation", {
              method: "PUT",
              body: form,
            }),
          "Confirmation template saved.",
        );
      }}
    >
      <Notice message={action.message} />
      <fieldset disabled={action.busy}>
        <legend className="sr-only">Registration confirmation template</legend>
        <Field
          label="Subject"
          required
          maxLength="200"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
        <div className="form-grid">
          <Field label="HTML email">
            <textarea
              className="code-input"
              rows="16"
              required
              maxLength="50000"
              value={form.htmlBody}
              onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
            />
          </Field>
          <Field label="Plain text version">
            <textarea
              className="code-input"
              rows="16"
              required
              maxLength="50000"
              value={form.textBody}
              onChange={(e) => setForm({ ...form, textBody: e.target.value })}
            />
          </Field>
        </div>
        <details className="panel subtle">
          <summary>Available template variables</summary>
          <div className="variable-list">
            {[
              "bowlerName",
              "tournamentName",
              "tournamentLocation",
              "tournamentDate",
              "entryFee",
              "squadsList",
              "paymentInstructions",
              "registrationId",
            ].map((v) => (
              <code key={v}>{`{{${v}}}`}</code>
            ))}
          </div>
        </details>
        <div className="actions">
          <button className="button">
            {action.busy ? "Working…" : "Save template"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              action.run(async () =>
                setPreview(
                  await api("/api/email-templates/preview", {
                    method: "POST",
                    body: form,
                  }),
                ),
              )
            }
          >
            Preview with sample data
          </button>
        </div>
      </fieldset>
      {preview && (
        <Dialog title="Email preview" onClose={() => setPreview(null)}>
          <h3>{preview.subject}</h3>
          <iframe
            title="Registration email preview"
            sandbox=""
            srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{font:16px/1.6 system-ui;padding:24px;color:#152333}</style>${preview.htmlBody}`}
          />
          <details>
            <summary>Plain text</summary>
            <pre className="preserve-lines">{preview.textBody}</pre>
          </details>
        </Dialog>
      )}
    </form>
  );
}
