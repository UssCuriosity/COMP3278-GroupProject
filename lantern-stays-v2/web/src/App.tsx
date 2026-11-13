// App shell: header, routes, footer, toasts and the SQL inspector.
import type { UseQueryResult } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { errorMessage } from './api';
import { useAuth } from './auth';
import { Header } from './components';
import { Home } from './pages/Home';
import { Host } from './pages/Host';
import { Listing } from './pages/Listing';
import { ListingForm } from './pages/ListingForm';
import { Saved } from './pages/Saved';
import { Search } from './pages/Search';
import { Trips } from './pages/Trips';
import { SqlInspector } from './SqlInspector';
import { EmptyState, Toasts } from './ui';

const homeLink = (
  <Link className="btn btn-primary" to="/">
    Back to home
  </Link>
);

// Shown while a query has no data yet: a loading line, or the error it ended with.
export function Loading({ query }: { query: Pick<UseQueryResult, 'error'> }) {
  if (query.error) return <EmptyState title="Something went wrong" text={errorMessage(query.error)} action={homeLink} />;
  return <p className="loading">Loading...</p>;
}

// Pages that need an account show a log-in prompt instead of their content.
function RequireLogin({ to, children }: { to: string; children: ReactNode }) {
  const { user, loading, openAuth } = useAuth();
  if (loading) return <p className="loading">Loading...</p>;
  if (user) return children;
  return (
    <EmptyState
      title="Please log in"
      text={`Log in to ${to}.`}
      action={
        <button className="btn btn-primary" type="button" onClick={() => openAuth('login')}>
          Log in
        </button>
      }
    />
  );
}

export function App() {
  const { pathname } = useLocation();
  // Start every page at the top. (Braces matter: newer browsers return a Promise
  // from scrollTo, and an effect may only return a cleanup function.)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Header />
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/listing/:id" element={<Listing />} />
          <Route path="/trips" element={<RequireLogin to="see your trips"><Trips /></RequireLogin>} />
          <Route path="/saved" element={<RequireLogin to="see your saved stays"><Saved /></RequireLogin>} />
          <Route path="/host" element={<RequireLogin to="manage your listings"><Host /></RequireLogin>} />
          <Route path="/host/new" element={<RequireLogin to="publish a listing"><ListingForm /></RequireLogin>} />
          <Route path="/host/edit/:id" element={<RequireLogin to="edit a listing"><ListingForm /></RequireLogin>} />
          <Route path="*" element={<EmptyState title="Page not found" text="That page does not exist." action={homeLink} />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <span>Lantern Stays</span>
        <span>COMP3278 final project · TypeScript + Fastify + React + MySQL</span>
      </footer>
      <Toasts />
      <SqlInspector />
    </>
  );
}
