import React, { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { date, money, registrationState } from "./utils.js";

export function Icon({ name = "arrow", ...props }) {
  const paths = {
    arrow: "M5 12h14m-6-6 6 6-6 6",
    calendar: "M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
    pin: "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    trophy:
      "M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 0h8",
    user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "m6 6 12 12M6 18 18 6",
    check: "m5 12 4 4L19 6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
export function PageHeader({
  eyebrow = "Revolution Rumble Tour",
  title,
  children,
  action,
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <p className="lede">{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function Notice({ message }) {
  return message ? (
    <div
      className={`notice ${message.type || "error"}`}
      role={message.type === "success" ? "status" : "alert"}
    >
      {message.text}
    </div>
  ) : null;
}
export function Resource({ resource, children }) {
  if (resource.loading)
    return (
      <div className="loading" role="status">
        <span className="spinner" /> Loading tour information…
      </div>
    );
  if (resource.error)
    return (
      <div className="empty">
        <Icon name="pin" />
        <h2>We couldn’t load this.</h2>
        <p>{resource.error.message}</p>
        <button className="button secondary" onClick={resource.reload}>
          Try again
        </button>
      </div>
    );
  return children;
}
export function Empty({ title = "Nothing here yet", children, action }) {
  return (
    <div className="empty">
      <Icon name="trophy" />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({ label, children, hint, className = "", ...props }) {
  const id = useId();
  return (
    <label className={`field ${className}`} htmlFor={id}>
      <span>{label}</span>
      {children ? (
        React.cloneElement(children, {
          id,
          "aria-describedby": hint ? `${id}-hint` : undefined,
        })
      ) : (
        <input
          id={id}
          {...props}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      )}{" "}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function Check({ label, ...props }) {
  return (
    <label className="check">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Badge({ children, tone = "" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function TournamentSelect({
  tournaments = [],
  value,
  onChange,
  all = false,
}) {
  return (
    <Field label="Tournament">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {all ? "All tournaments" : "Choose a tournament"}
        </option>
        {tournaments.map((t) => (
          <option key={t._id} value={t._id}>
            {t.name} · {date(t.startDate || t.date)}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Search({ value, onChange, placeholder = "Search bowlers…" }) {
  return (
    <label className="search">
      <Icon name="search" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function EventCard({ event }) {
  const registration = registrationState(event);
  return (
    <article className="event-card">
      <div className="event-art">
        <span className="event-monogram" aria-hidden="true">
          RR
        </span>
        <Badge tone={event.status === "ongoing" ? "live" : ""}>
          {event.status === "ongoing" ? "Live on the lanes" : event.status}
        </Badge>
        <span className="event-location">{event.location}</span>
      </div>
      <div className="event-content">
        <p className="meta">
          <Icon name="calendar" />
          {date(event.startDate || event.date)}
        </p>
        <h3>{event.name}</h3>
        <p className="event-description">
          {event.description ||
            "Step up to the lanes and be part of the Revolution Rumble tour."}
        </p>
        <div className="event-details">
          <span>
            {money(event.entryFee)} <small>entry</small>
          </span>
          <span>
            {event.format?.useHandicap ? "Handicap" : "Scratch"} format
          </span>
        </div>
        <div className="event-actions">
          <Link
            className="button"
            to={
              registration.open
                ? `/register?tournament=${event._id}`
                : `/results?tournament=${event._id}`
            }
          >
            {registration.open ? "Enter tournament" : "View results"}
            <Icon />
          </Link>
          <Link className="text-link" to={`/events/${event._id}`}>
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
export function Dialog({ title, children, onClose }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({ title, children, onConfirm, onClose, busy = false }) {
  return (
    <Dialog title={title} onClose={() => !busy && onClose()}>
      <p>{children}</p>
      <div className="actions">
        <button className="button danger" disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : "Confirm"}
        </button>
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Keep it
        </button>
      </div>
    </Dialog>
  );
}
