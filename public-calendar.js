import { malaysiaDate, upcomingEvents } from './event-utils.js';

const list = document.getElementById('calendar-list');
const status = document.getElementById('calendar-status');

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function link(label, href, style) {
  const anchor = makeElement('a', label, 'button ' + style);
  anchor.href = href;
  return anchor;
}

function registrationLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

try {
  const response = await fetch('data/events.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Schedule unavailable');
  const events = await response.json();
  const today = malaysiaDate();
  // Existing public records predate the optional visibility and status fields.
  const publicEvents = events.filter(event => event.public !== false && (!event.status || event.status === 'confirmed'));
  const scheduled = upcomingEvents(publicEvents, today);
  for (const event of scheduled) {
    const card = makeElement('li', '', 'v2-card');
    const date = [event.dateLabel || event.startDate, event.time].filter(Boolean).join(' · ');
    const actions = makeElement('div', '', 'v2-actions');
    actions.append(link('Event details →', './#event/' + encodeURIComponent(event.id), 'outline'));
    const register = registrationLink(event.registrationUrl);
    if (register) actions.append(link('Register ↗', register, 'red'));
    card.append(makeElement('p', date, 'eyebrow'), makeElement('h2', event.title), makeElement('p', event.venue || 'Venue to be announced'), actions);
    list.append(card);
  }
  status.textContent = scheduled.length ? '' : 'No upcoming events are listed. Check back for new dates.';
} catch {
  status.textContent = 'The schedule could not be loaded. Try refreshing this page.';
}

