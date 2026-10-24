import { Component, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { api, resetCsrf } from "./api.js";
import { useAction, useResource } from "./hooks.js";
import { Empty, Icon, Notice, Resource } from "./components.jsx";
import {
  Home,
  Events,
  EventDetails,
  Squads,
  Results,
  PlayerStats,
} from "./pages/Public.jsx";
import { Register } from "./pages/Register.jsx";
import { Hub, Login } from "./pages/Hub.jsx";
import {
  AdminTournaments,
  AdminRegistrations,
  AdminEmails,
} from "./pages/Admin.jsx";
import { AdminResults } from "./pages/AdminResults.jsx";

const links = [
  ["/", "Home"],
  ["/events", "Events"],
  ["/squads", "Squads"],
  ["/results", "Results"],
  ["/player-stats", "Player stats"],
];
function Layout() {
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    document.title = `${links.find(([path]) => path === location.pathname)?.[1] || { "/register": "Registration", "/bowler-hub": "Bowler Hub" }[location.pathname] || (location.pathname.startsWith("/admin") ? "Admin" : "Tournament")} | Revolution Rumble`;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Revolution Rumble home">
            <img src="/static/images/rumble-mark.svg" alt="" />
            <span>
              REVOLUTION
              <strong>
                RUMBLE<span> TOUR</span>
              </strong>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}>
                {label}
              </NavLink>
            ))}
          </nav>
          <Link className="hub-link" to="/bowler-hub">
            <Icon name="user" />
            <span>Bowler Hub</span>
          </Link>
          <Link className="button header-cta" to="/register">
            Enter an event <Icon />
          </Link>
          <button
            className="icon-button menu-button"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
          >
            <Icon name={menu ? "close" : "menu"} />
          </button>
        </div>
        {menu && (
          <nav
            id="mobile-menu"
            className="mobile-nav"
            aria-label="Mobile navigation"
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenu(false);
            }}
          >
            {[
              ...links,
              ["/register", "Enter an event"],
              ["/bowler-hub", "Bowler Hub"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setMenu(false)}
              >
                {label}
                <Icon />
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main
        id="main-content"
        className={`container main-content ${location.pathname === "/" ? "home-page" : ""}`}
        tabIndex="-1"
      >
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <div>
            <Link className="footer-brand" to="/">
              REVOLUTION RUMBLE<span> BOWL BOLD. MAKE NOISE.</span>
            </Link>
            <p>Good people. Great bowling. One unforgettable tour.</p>
          </div>
          <nav aria-label="Footer navigation">
            <Link to="/events">Events</Link>
            <Link to="/squads">Squads</Link>
            <Link to="/bowler-hub">Bowler Hub</Link>
            <Link to="/admin/login">Admin</Link>
          </nav>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Revolution Rumble Tour</span>
          <span>Powered by Revolution Bowling Supplies</span>
        </div>
      </footer>
    </>
  );
}
function AdminLayout() {
  const location = useLocation();
  const session = useResource(
    `/api/admin/session?path=${encodeURIComponent(location.pathname)}`,
  );
  const action = useAction();
  return (
    <Resource resource={session}>
      {session.data?.authenticated ? (
        <>
          <div className="admin-nav">
            <span className="eyebrow">Tour control</span>
            <nav aria-label="Admin navigation">
              {[
                ["tournaments", "Tournaments"],
                ["registrations", "Registrations"],
                ["results", "Scoring"],
                ["email-templates", "Emails"],
              ].map(([path, label]) => (
                <NavLink key={path} to={`/admin/${path}`}>
                  {label}
                </NavLink>
              ))}
            </nav>
            <button
              className="text-link"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  await api("/admin/logout", { method: "POST" });
                  resetCsrf();
                  session.reload();
                })
              }
            >
              Sign out
            </button>
          </div>
          <Notice message={action.message} />
          <Outlet />
        </>
      ) : (
        session.data && <Navigate to="/admin/login" replace />
      )}
    </Resource>
  );
}
class ErrorBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="container">
        <Empty
          title="Something went wrong"
          action={
            <button className="button" onClick={() => window.location.reload()}>
              Reload page
            </button>
          }
        >
          Please reload the page to try again. Your saved data is safe.
        </Empty>
      </div>
    ) : (
      this.props.children
    );
  }
}
function LegacyResults() {
  const location = useLocation();
  return new URLSearchParams(location.search).get("tab") === "stats" ? (
    <Navigate to="/player-stats" replace />
  ) : (
    <Results />
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetails />} />
            <Route path="register" element={<Register />} />
            <Route path="squads" element={<Squads />} />
            <Route path="results" element={<LegacyResults />} />
            <Route path="player-stats" element={<PlayerStats />} />
            <Route
              path="playerstats"
              element={<Navigate to="/player-stats" replace />}
            />
            <Route
              path="bowlerstats"
              element={<Navigate to="/player-stats" replace />}
            />
            <Route path="bowler-hub" element={<Hub />} />
            <Route path="admin/login" element={<Login admin />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="tournaments" replace />} />
              <Route path="tournaments" element={<AdminTournaments />} />
              <Route path="registrations" element={<AdminRegistrations />} />
              <Route path="results" element={<AdminResults />} />
              <Route path="email-templates" element={<AdminEmails />} />
            </Route>
            <Route
              path="*"
              element={
                <Empty
                  title="This lane is out of play."
                  action={
                    <Link className="button" to="/">
                      Back to the tour <Icon />
                    </Link>
                  }
                >
                  We couldn’t find that page. Let’s get you back on track.
                </Empty>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
