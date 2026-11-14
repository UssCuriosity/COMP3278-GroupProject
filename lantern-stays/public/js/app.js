// App shell: header, hash router and start-up.
import { api } from './api.js';
import { h, toast } from './dom.js';
import { state, setUser, onUserChange, loadSession, setRenderer } from './store.js';
import { openAuthDialog, emptyState } from './components.js';
import { initInspector } from './inspector.js';
import * as home from './views/home.js';
import * as search from './views/search.js';
import * as listing from './views/listing.js';
import * as trips from './views/trips.js';
import * as saved from './views/saved.js';
import * as host from './views/host.js';
import * as listingForm from './views/listing-form.js';

const routes = [
  { pattern: /^\/$/, view: home },
  { pattern: /^\/search$/, view: search },
  { pattern: /^\/listing\/(\d+)$/, view: listing },
  { pattern: /^\/trips$/, view: trips, needsLogin: 'see your trips' },
  { pattern: /^\/saved$/, view: saved, needsLogin: 'see your saved stays' },
  { pattern: /^\/host$/, view: host, needsLogin: 'manage your listings' },
  { pattern: /^\/host\/new$/, view: listingForm, needsLogin: 'publish a listing' },
  { pattern: /^\/host\/edit\/(\d+)$/, view: listingForm, needsLogin: 'edit a listing' },
];

function parseHash() {
  const [path, queryString = ''] = (location.hash.slice(1) || '/').split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(queryString)) };
}

function renderHeader(path) {
  const navLink = (href, label, active) => h('a', { class: `nav-link${active ? ' is-active' : ''}`, href }, label);
  const user = state.user;
  document.getElementById('site-header').replaceChildren(
    h(
      'div',
      { class: 'header-inner' },
      h('a', { class: 'brand', href: '#/' }, h('img', { src: '/img/favicon.svg', alt: '', width: 30, height: 30 }), h('span', {}, 'Lantern Stays')),
      h(
        'nav',
        { class: 'nav' },
        navLink('#/search', 'Explore', path === '/search' || path.startsWith('/listing')),
        navLink('#/trips', 'Trips', path === '/trips'),
        navLink('#/saved', 'Saved', path === '/saved'),
        navLink('#/host', 'Host', path.startsWith('/host'))
      ),
      user
        ? h(
            'div',
            { class: 'user' },
            h('span', { class: 'avatar' }, user.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()),
            h('span', { class: 'user-name' }, user.name),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: logout }, 'Log out')
          )
        : h(
            'div',
            { class: 'user' },
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => openAuthDialog('login') }, 'Log in'),
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openAuthDialog('register') }, 'Sign up')
          )
    )
  );
}

async function logout() {
  try {
    await api('POST', '/auth/logout');
    setUser(null);
    toast('You are logged out.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

let renderToken = 0;
let lastPath = null;

async function renderRoute() {
  const { path, query } = parseHash();
  const token = (renderToken += 1);
  renderHeader(path);

  const page = h('div', { class: 'view' });
  let match = null;
  const route = routes.find((candidate) => (match = path.match(candidate.pattern)));

  try {
    if (!route) {
      page.append(emptyState({ title: 'Page not found', text: 'That page does not exist.', action: h('a', { class: 'btn btn-primary', href: '#/' }, 'Back to home') }));
    } else if (route.needsLogin && !state.user) {
      page.append(
        emptyState({
          title: 'Please log in',
          text: `Log in to ${route.needsLogin}.`,
          action: h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openAuthDialog('login') }, 'Log in'),
        })
      );
    } else {
      await route.view.render(page, { params: match.slice(1), query });
    }
  } catch (error) {
    page.replaceChildren(emptyState({ title: 'Something went wrong', text: error.message, action: h('a', { class: 'btn btn-primary', href: '#/' }, 'Back to home') }));
  }

  if (token !== renderToken) return; // a newer navigation has taken over
  document.getElementById('app').replaceChildren(page);
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

async function start() {
  initInspector();
  setRenderer(renderRoute);
  try {
    await loadSession();
  } catch (error) {
    toast(error.message, 'error');
  }
  onUserChange(() => {
    document.getElementById('app').replaceChildren();
    renderRoute();
  });
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}

start();
