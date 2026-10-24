import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useResource } from "../hooks.js";
import {
  Badge,
  Empty,
  EventCard,
  Field,
  Icon,
  PageHeader,
  Resource,
  Search,
  TournamentSelect,
} from "../components.jsx";
import { date, money, number, registrationState, stagesOf } from "../utils.js";

export function Home() {
  const tournaments = useResource("/api/tournaments");
  const upcoming = (tournaments.data || []).filter(
    (t) => t.status === "upcoming",
  );
  const next = upcoming[0];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const days = next
    ? Math.max(
        0,
        Math.ceil((new Date(next.startDate || next.date) - now) / 86400000),
      )
    : null;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> The Revolution Rumble Tour
          </p>
          <h1>
            Bowl bold.
            <br />
            <span>Make noise.</span>
          </h1>
          <p>
            Big frames. Fierce competition. Your next personal best.
            <br className="desktop-only" /> Find your place on the regional
            tenpin tour.
          </p>
          <div className="actions">
            <Link className="button" to="/events">
              Find your next event <Icon />
            </Link>
            <Link className="button secondary" to="/results">
              Explore results
            </Link>
          </div>
          <div className="hero-footnote">
            <span>Built for bowlers.</span>
            <span>Powered by competition.</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-lines" />
          <img
            src="/static/images/whitebghighres.png"
            alt="Revolution Rumble Tenpin Tour"
            className="hero-logo"
          />
          <div className="next-event">
            <span className="eyebrow">Next on the tour</span>
            {next ? (
              <>
                <strong>{next.name}</strong>
                <div>
                  <span>
                    {date(next.startDate || next.date)} · {next.location}
                  </span>
                  <b>
                    {days}
                    <small> days to go</small>
                  </b>
                </div>
              </>
            ) : (
              <>
                <strong>
                  {tournaments.loading
                    ? "Finding your next event…"
                    : "The next chapter is coming."}
                </strong>
                <Link to="/events">
                  Explore the tournament calendar <Icon />
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="partner-strip" aria-label="Tour partners">
        <span className="eyebrow">
          Good company.
          <br />
          Great competition.
        </span>
        {[
          [
            "Revolution Bowling Supplies - white logo.png",
            "Revolution Bowling Supplies",
          ],
          ["Loganlogo.png", "Logan City Tenpin"],
          ["ashmorelogo.png", "Ashmore"],
          ["ballinalogo.png", "Ballina"],
          ["toowoombalogo.svg", "Toowoomba"],
        ].map(([src, name]) => (
          <img
            key={src}
            src={`/static/images/${src}`}
            alt={name}
            loading="lazy"
          />
        ))}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your next challenge</p>
            <h2>See you on the lanes.</h2>
          </div>
          <Link className="text-link" to="/events">
            All events <Icon />
          </Link>
        </div>
        <Resource resource={tournaments}>
          {upcoming.length ? (
            <div className="card-grid">
              {upcoming.slice(0, 3).map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          ) : (
            <Empty
              title="More competition is on the way"
              action={
                <Link className="button secondary" to="/results">
                  Explore past results
                </Link>
              }
            >
              Upcoming tournaments will appear here as they’re announced.
            </Empty>
          )}
        </Resource>
      </section>
      <section className="hub-banner">
        <div>
          <p className="eyebrow">Your game. All in one place.</p>
          <h2>Meet your Bowler Hub.</h2>
          <p>
            Manage your entries, update your profile, and follow your progress
            across the tour.
          </p>
        </div>
        <Link className="button" to="/bowler-hub">
          Open Bowler Hub <Icon name="user" />
        </Link>
      </section>
    </>
  );
}

export function Events() {
  const resource = useResource("/api/tournaments");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const events = (resource.data || []).filter(
    (t) =>
      (status === "all" || t.status === status) &&
      `${t.name} ${t.location}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader title="Find your next challenge.">
        The venues, the formats, the competition. Your tour starts here.
      </PageHeader>
      <div className="toolbar">
        <div className="tabs" aria-label="Filter events">
          {["all", "upcoming", "ongoing", "completed"].map((value) => (
            <button
              key={value}
              aria-pressed={status === value}
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
            >
              {value === "ongoing" ? "Live now" : value}
            </button>
          ))}
        </div>
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Search events or venues…"
        />
      </div>
      <Resource resource={resource}>
        {events.length ? (
          <div className="card-grid">
            {events.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        ) : (
          <Empty title="No events found">
            Try another filter, or check back for new tournament announcements.
          </Empty>
        )}
      </Resource>
    </>
  );
}

export function EventDetails() {
  const { id } = useParams();
  const resource = useResource(`/api/tournaments/${id}`);
  const t = resource.data;
  const state = t && registrationState(t);
  return (
    <Resource resource={resource}>
      {t && (
        <>
          <Link className="back-link" to="/events">
            ← Back to events
          </Link>
          <PageHeader
            title={t.name}
            action={
              <Badge tone={state.open ? "success" : ""}>{state.label}</Badge>
            }
          >
            {t.location} · {date(t.startDate || t.date)}
            {t.endDate && t.endDate !== t.startDate
              ? ` – ${date(t.endDate)}`
              : ""}
          </PageHeader>
          <div className="split-layout">
            <div>
              <section className="panel">
                <h2>The tournament</h2>
                <p className="preserve-lines">
                  {t.description ||
                    "Join the competition and make your mark on the tour."}
                </p>
                <div className="metric-grid">
                  <div>
                    <strong>{money(t.entryFee)}</strong>
                    <span>Entry fee</span>
                  </div>
                  <div>
                    <strong>
                      {t.format?.useHandicap ? "Handicap" : "Scratch"}
                    </strong>
                    <span>Scoring format</span>
                  </div>
                  <div>
                    <strong>{t.maxParticipants || "Open"}</strong>
                    <span>Field capacity</span>
                  </div>
                </div>
              </section>
              <section className="panel">
                <h2>How it plays out</h2>
                <ol className="stage-list">
                  {stagesOf(t).map((stage, index) => (
                    <li key={index}>
                      <span className="stage-number">{index + 1}</span>
                      <div>
                        <h3>{stage.name}</h3>
                        <p>
                          {stage.type.replaceAll("_", " ")} · {stage.games}{" "}
                          games
                          {stage.advancingBowlers
                            ? ` · Top ${stage.advancingBowlers} advance`
                            : ""}
                        </p>
                        {stage.description && <p>{stage.description}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <aside className="panel sticky">
              <p className="eyebrow">Make it official</p>
              <h2>Your next big game.</h2>
              <p>
                {state.open
                  ? "Choose your squads and secure your tournament entry."
                  : state.label}
              </p>
              {state.open && (
                <Link className="button full" to={`/register?tournament=${id}`}>
                  Enter tournament <Icon />
                </Link>
              )}
              <Link
                className="button secondary full"
                to={`/squads?tournament=${id}`}
              >
                View squad lists
              </Link>
              <Link className="text-link" to={`/results?tournament=${id}`}>
                Tournament results <Icon />
              </Link>
              {t.registrationDeadline && (
                <p className="small">
                  Entries close {date(t.registrationDeadline)}.
                </p>
              )}
              <hr />
              <h3>Payment details</h3>
              <p className="preserve-lines">{t.paymentInstructions}</p>
            </aside>
          </div>
        </>
      )}
    </Resource>
  );
}

export function useTournamentSelection() {
  const tournaments = useResource("/api/tournaments");
  const [params, setParams] = useSearchParams();
  const id = params.get("tournament") || params.get("tournamentId") || "";
  const select = (value) => {
    const next = new URLSearchParams(params);
    next.delete("tournamentId");
    if (value) next.set("tournament", value);
    else next.delete("tournament");
    setParams(next);
  };
  return {
    tournaments,
    id,
    select,
    tournament: tournaments.data?.find((t) => t._id === id),
  };
}

export function Squads() {
  const { tournaments, id, select } = useTournamentSelection();
  const resource = useResource(
    id ? `/api/tournaments/${id}/squads/list` : null,
  );
  const [query, setQuery] = useState("");
  return (
    <>
      <PageHeader title="Find your squad.">
        Check the line-up, see who’s bowling, and plan your tournament day.
      </PageHeader>
      <Resource resource={tournaments}>
        <div className="toolbar">
          <TournamentSelect
            tournaments={tournaments.data}
            value={id}
            onChange={select}
          />
          <Search value={query} onChange={setQuery} />
          {id && (
            <button className="button secondary" onClick={resource.reload}>
              Refresh lists
            </button>
          )}
        </div>
      </Resource>
      {!id ? (
        <Empty title="Who’s on the lanes?">
          Choose a tournament to see its squads and registered bowlers.
        </Empty>
      ) : (
        <Resource resource={resource}>
          {resource.data?.squads?.length ? (
            <div className="card-grid">
              {resource.data.squads.map((squad) => (
                <section className="panel" key={squad._id}>
                  <div className="section-heading">
                    <h2>{squad.name}</h2>
                    <Badge tone={squad.spotsRemaining > 0 ? "success" : ""}>
                      {Math.max(0, squad.spotsRemaining)} spots left
                    </Badge>
                  </div>
                  <p className="meta">
                    {date(squad.date)} · {squad.time}
                  </p>
                  <progress
                    value={squad.registered}
                    max={squad.capacity}
                    aria-label={`${squad.registered} of ${squad.capacity} places filled`}
                  />
                  <p className="small">
                    {squad.registered} / {squad.capacity} bowlers ·{" "}
                    {squad.isQualifying
                      ? "Qualifying"
                      : squad.stageName || "Finals"}
                  </p>
                  <ul className="bowler-list">
                    {squad.bowlers
                      .filter((b) =>
                        b.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((bowler, i) => (
                        <li key={`${bowler.name}-${i}`}>
                          <span>
                            {bowler.bowlerId ? (
                              <Link
                                to={`/player-stats?bowler=${bowler.bowlerId}`}
                              >
                                {bowler.name}
                              </Link>
                            ) : (
                              bowler.name
                            )}
                          </span>
                          <span className="muted">
                            {number(bowler.averageScore)} avg
                          </span>
                        </li>
                      ))}
                  </ul>
                  {!squad.bowlers.length && (
                    <p className="muted">Be the first on the list.</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <Empty title="Squads haven’t been published yet">
              Check the event details for the latest information.
            </Empty>
          )}
        </Resource>
      )}
    </>
  );
}

export function Results() {
  const { tournaments, id, select } = useTournamentSelection();
  const resource = useResource(id ? `/api/tournaments/${id}/results` : null);
  const [stageIndex, setStageIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [squad, setSquad] = useState("");
  const stages = resource.data?.hasStages
    ? resource.data.stages
    : [{ stageName: "Leaderboard", players: resource.data?.players || [] }];
  const stage = stages?.[stageIndex] || stages?.[0];
  const players = (stage?.players || []).filter(
    (p) =>
      p.playerName.toLowerCase().includes(query.toLowerCase()) &&
      (!squad || p.squadIds?.includes(squad)),
  );
  return (
    <>
      <PageHeader title="Every frame counts.">
        Follow the standings, game scores, and tournament performances.
      </PageHeader>
      <Resource resource={tournaments}>
        <div className="toolbar">
          <TournamentSelect
            tournaments={tournaments.data}
            value={id}
            onChange={(value) => {
              select(value);
              setStageIndex(0);
              setSquad("");
            }}
          />
          {id && (
            <button className="button secondary" onClick={resource.reload}>
              Refresh results
            </button>
          )}
        </div>
      </Resource>
      {!id ? (
        <Empty title="The story is in the scores">
          Select a tournament to explore its results.
        </Empty>
      ) : (
        <Resource resource={resource}>
          <div className="toolbar">
            <div className="tabs" aria-label="Result stages">
              {stages?.map((stage, index) => (
                <button
                  key={index}
                  className={stageIndex === index ? "active" : ""}
                  onClick={() => setStageIndex(index)}
                >
                  {stage.stageName}
                </button>
              ))}
            </div>
            <Search value={query} onChange={setQuery} />
          </div>
          {resource.data?.tournament.squads?.length > 0 && (
            <Field label="Squad">
              <select value={squad} onChange={(e) => setSquad(e.target.value)}>
                <option value="">All squads</option>
                {resource.data.tournament.squads.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {players.length ? (
            <div className="table-wrap">
              <table>
                <caption>
                  {resource.data?.tournament.name} · {stage.stageName}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Place</th>
                    <th scope="col">Bowler</th>
                    <th scope="col">Games</th>
                    <th scope="col">Scratch</th>
                    <th scope="col">Handicap</th>
                    <th scope="col">Bonus</th>
                    <th scope="col">Carry</th>
                    <th scope="col">Total</th>
                    <th scope="col">Average</th>
                    <th scope="col">High</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => (
                    <tr key={`${player.playerName}-${index}`}>
                      <td>
                        <span className={`rank rank-${player.position}`}>
                          {player.position}
                        </span>
                      </td>
                      <th scope="row">
                        {player.playerName}
                        <details className="score-details">
                          <summary>Game breakdown</summary>
                          <div>
                            {player.scores?.map((score, i) => (
                              <span key={i} title={player.matchups?.[i]?.label}>
                                G{i + 1}: <b>{score}</b>
                                {player.bonusPins?.[i]
                                  ? ` (+${player.bonusPins[i]})`
                                  : ""}
                              </span>
                            ))}
                          </div>
                          {player.matchups?.map((match, i) => (
                            <small key={i}>{match.label}</small>
                          ))}
                        </details>
                      </th>
                      <td>{player.gamesPlayed}</td>
                      <td>{number(player.scratchTotal)}</td>
                      <td>{number(player.totalHandicap)}</td>
                      <td>{number(player.totalBonus)}</td>
                      <td>{number(player.carryover || 0)}</td>
                      <td className="accent strong">{number(player.total)}</td>
                      <td>{number(player.average)}</td>
                      <td>{number(player.high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={
                query || squad
                  ? "No matching scores"
                  : "The scores are still to come"
              }
            >
              {query || squad
                ? "Try clearing your filters."
                : "Results will appear once the tournament team records the first games."}
            </Empty>
          )}
        </Resource>
      )}
    </>
  );
}

export function PlayerStats() {
  const resource = useResource("/api/bowlers");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("tournamentAverage");
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("bowler");
  const profile = useResource(selectedId ? `/api/bowlers/${selectedId}` : null);
  const bowlers = (resource.data || [])
    .filter(
      (b) =>
        b.playerName &&
        `${b.playerName} ${b.nickname || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "playerName"
        ? a.playerName.localeCompare(b.playerName)
        : (b[sort] ?? -1) - (a[sort] ?? -1),
    );
  return (
    <>
      <PageHeader title="Know the competition.">
        Personal bests, tour averages, and the bowlers raising the bar.
      </PageHeader>
      {selectedId && (
        <Resource resource={profile}>
          {profile.data && (
            <section className="panel profile-summary">
              <button
                className="icon-button"
                aria-label="Close player profile"
                onClick={() => setParams({})}
              >
                <Icon name="close" />
              </button>
              <p className="eyebrow">Bowler profile</p>
              <h2>{profile.data.playerName}</h2>
              <p>
                {profile.data.nickname}
                {profile.data.homeCenter ? ` · ${profile.data.homeCenter}` : ""}
              </p>
              <p>{profile.data.bio}</p>
              <div className="metric-grid">
                {[
                  ["Tournament average", profile.data.tournamentAverage],
                  ["High game", profile.data.highGame],
                  ["High series", profile.data.highSeries],
                ].map(([label, value]) => (
                  <div key={label}>
                    <strong>{number(value)}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </Resource>
      )}
      <div className="toolbar">
        <Search value={query} onChange={setQuery} />
        <Field label="Sort by">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="tournamentAverage">Tournament average</option>
            <option value="highGame">High game</option>
            <option value="highSeries">High series</option>
            <option value="playerName">Name A–Z</option>
          </select>
        </Field>
      </div>
      <Resource resource={resource}>
        {bowlers.length ? (
          <div className="table-wrap">
            <table>
              <caption>{bowlers.length} bowlers · tour statistics</caption>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bowler</th>
                  <th>Tour average</th>
                  <th>Current average</th>
                  <th>High game</th>
                  <th>High series</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {bowlers.map((bowler, index) => (
                  <tr key={bowler._id}>
                    <td>
                      <span className={`rank rank-${index + 1}`}>
                        {index + 1}
                      </span>
                    </td>
                    <th scope="row">
                      <button
                        className="text-link"
                        onClick={() => {
                          setParams({ bowler: bowler._id });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        {bowler.playerName}
                      </button>
                      {bowler.nickname && (
                        <small className="block muted">{bowler.nickname}</small>
                      )}
                    </th>
                    <td className="accent strong">
                      {number(bowler.tournamentAverage)}
                    </td>
                    <td>{number(bowler.currentAverage)}</td>
                    <td>{number(bowler.highGame)}</td>
                    <td>{number(bowler.highSeries)}</td>
                    <td>{bowler.tournamentsEntered?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              query ? "No bowlers found" : "The leaderboard starts with you"
            }
          >
            {query
              ? "Try searching for a different name."
              : "Bowler statistics will appear as players join the tour."}
          </Empty>
        )}
      </Resource>
    </>
  );
}
