import { calculateRankings, tierLabel } from './ranking.js';
import { eventState, sortNewest, upcomingEvents, malaysiaDate } from './event-utils.js';

const $ = id => document.getElementById(id);
const el = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const dialog = $('event-dialog');
let events = [], rankings = [], season = null, weeklyExpanded = false, previousHash = '#events';
let archiveFilter = 'all';
const emptyTemplate = $('ranking-empty').cloneNode(true);
const today = malaysiaDate();
$('copyright-year').textContent = today.slice(0, 4);

function safeLink(url, text, className = 'button outline') {
  const parsed = new URL(url, location.href);
  if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw Error('Unsupported link');
  const a = el('a', text, className);
  a.href = parsed.href;
  if (parsed.origin !== location.origin && parsed.protocol !== 'mailto:') {
    a.target = '_blank'; a.rel = 'noopener noreferrer';
  }
  return a;
}
function pauseEventVideos() { dialog.querySelectorAll('video').forEach(video => video.pause()); }
function closeDialog() { pauseEventVideos(); dialog.close(); }
$('dialog-close').addEventListener('click', closeDialog);
dialog.addEventListener('click', e => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
});
dialog.addEventListener('close', () => {
  pauseEventVideos();
  if (location.hash.startsWith('#event/')) history.replaceState(null, '', location.pathname + location.search + previousHash);
});
function resetDialog(label, title, meta, mediaOnly = false) {
  pauseEventVideos();
  $('event-media').replaceChildren();
  $('event-media').hidden = true;
  $('dialog-label').textContent = label;
  $('dialog-title').textContent = title;
  $('dialog-meta').textContent = meta;
  for (const id of ['dialog-art', 'dialog-description', 'dialog-metrics', 'dialog-details', 'dialog-actions']) $(id).replaceChildren();
  document.querySelector('.dialog-content').classList.toggle('media-only', mediaOnly);
}
function showMedia(path, title, label = 'GG / ORIGINAL PHOTOGRAPH') {
  resetDialog(label, title, 'Original supplied image', true);
  const image = el('img'); image.src = path; image.alt = title;
  $('dialog-art').append(image);
  if (!dialog.open) dialog.showModal();
}
document.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => showMedia(button.dataset.photo, button.dataset.title)));
document.querySelectorAll('[data-qr]').forEach(button => button.addEventListener('click', () => showMedia(button.dataset.qr, button.dataset.title, 'SCAN TO CONNECT')));

function eventTierText(event) { return `${tierLabel(season?.eventTiers?.[event.id] || 'regular')} · DRAFT / eligibility TBA`; }
function openEvent(event, updateHash = true) {
  const state = eventState(event, today);
  const labels = { weekly: 'WEEKLY / NIGHT BATTLE', junior: 'ESPORTS / LITTLE RACERS', mall: 'GG / EVENT ARCHIVE' };
  resetDialog(labels[event.kind] || 'GG EVENT', event.title, `${event.dateLabel} · ${event.venue} · ${state.label}`);
  const image = el('img'); image.src = event.poster; image.alt = `${event.title} supplied poster`;
  $('dialog-art').append(image);
  $('dialog-description').textContent = event.description;
  $('dialog-details').append(el('p', eventTierText(event), 'event-tier')); 
  $('dialog-details').append(el('p', event.details));
  $('dialog-actions').append(safeLink(event.poster, 'OPEN POSTER ↗'));
  if (event.registrationUrl && ['upcoming', 'today'].includes(state.id)) {
    $('dialog-actions').prepend(safeLink(event.registrationUrl, 'REGISTER NOW ↗', 'button red'));
  }
  $('dialog-actions').append(safeLink(`mailto:gaminggeniusmy@gmail.com?subject=${encodeURIComponent(event.title + ' enquiry')}`, 'ASK GG ↗'));
  const copy = el('button', 'COPY EVENT LINK ⧉', 'button outline');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(new URL(`#event/${event.id}`, location.href).href); copy.textContent = 'LINK COPIED ✓'; }
    catch { copy.textContent = 'COPY THIS PAGE URL'; }
  });
  $('dialog-actions').append(copy);
  if (event.videos?.length) {
    const media = $('event-media');
    media.hidden = false;
    media.append(el('p', 'THE MOMENTS THAT STAY', 'eyebrow'), el('h3', 'EVENT FILMS'));
    for (const film of event.videos) {
      const article = el('article', undefined, 'event-film');
      article.append(el('h4', film.title), el('p', film.description || '', 'film-description'));
      const video = el('video');
      video.controls = true;
      video.preload = 'none';
      video.addEventListener('play', () => {
        dialog.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); });
      });
      video.playsInline = true;
      video.poster = film.poster;
      const setRatio = (width, height) => {
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
          video.style.aspectRatio = width + ' / ' + height;
          video.style.setProperty('--film-ratio', String(width / height));
        }
      };
      setRatio(film.width, film.height);
      video.addEventListener('loadedmetadata', () => setRatio(video.videoWidth, video.videoHeight));
      video.setAttribute('aria-label', film.title);
      const source = el('source'); source.src = film.src; source.type = film.type || 'video/mp4';
      video.append(source, 'Your browser does not support this video.');
      const videoLink = safeLink(film.src, 'OPEN VIDEO IN A NEW TAB ↗', 'text-link film-link');
      videoLink.target = '_blank'; videoLink.rel = 'noopener noreferrer';
      article.append(video, videoLink);
      const error = el('p', 'The video could not load. Try opening it in a new tab.', 'film-error');
      error.hidden = true;
      const showError = () => { error.hidden = false; };
      source.addEventListener('error', showError); video.addEventListener('error', showError);
      article.append(error); media.append(article);
    }
    const watch = el('button', event.id === 'racers-1' ? 'WATCH EVENT RECAP ↓' : 'WATCH EVENT VIDEOS ↓', 'button red');
    watch.addEventListener('click', () => media.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }));
    $('dialog-actions').prepend(watch);
  }
  if (updateHash) {
    previousHash = location.hash.startsWith('#event/') ? '#events' : location.hash || '#events';
    history.pushState(null, '', `#event/${event.id}`);
  }
  if (!dialog.open) dialog.showModal();
}
function eventCard(event) {
  const article = el('article', undefined, 'event-card');
  const art = el('button', undefined, 'event-art');
  art.setAttribute('aria-label', `View ${event.title}, ${event.dateLabel}`);
  const image = el('img'); image.src = event.thumbnail; image.alt = `${event.title} event poster`; image.loading = 'lazy'; image.decoding = 'async';
  art.append(image); art.addEventListener('click', () => openEvent(event));
  const copy = el('div', undefined, 'event-card-copy');
  const meta = el('div', undefined, 'event-card-meta');
  const state = eventState(event, today);
  meta.append(el('span', event.dateLabel, 'event-date'), el('span', state.label, `status ${state.id}`));
  const title = el('h3', undefined, 'event-title');
  const button = el('button', event.title); button.addEventListener('click', () => openEvent(event)); title.append(button);
  copy.append(meta, title, el('p', event.venue, 'event-venue'), el('p', eventTierText(event), 'event-tier')); 
  article.append(art, copy); return article;
}
function renderArchive() {
  const list = sortNewest(events.filter(e => e.kind !== 'weekly' && (archiveFilter === 'all' || e.category === archiveFilter)));
  $('event-count').textContent = `${list.length} EVENTS`;
  $('event-grid').replaceChildren(...list.map(eventCard));
  if (!list.length) $('event-grid').append(el('p', 'No events in this category yet.', 'load-state'));
}
function renderWeekly() {
  const list = sortNewest(events.filter(e => e.kind === 'weekly'));
  $('weekly-count').textContent = `${list.length} DATED BATTLE NIGHTS`;
  $('weekly-toggle').hidden = list.length <= 5;
  $('weekly-toggle').textContent = weeklyExpanded ? 'SHOW RECENT BATTLES ↑' : 'SHOW ALL BATTLES ↓';
  $('weekly-toggle').setAttribute('aria-expanded', String(weeklyExpanded));
  $('weekly-grid').replaceChildren(...(weeklyExpanded ? list : list.slice(0, 5)).map(eventCard));
}
function renderUpcoming() {
  const list = upcomingEvents(events, today).slice(0, 2);
  $('upcoming-grid').replaceChildren(...list.map(event => {
    const card = el('article', undefined, 'next-card');
    const art = el('button', undefined, 'next-poster'); art.setAttribute('aria-label', `View ${event.title} poster`);
    const image = el('img'); image.src = event.thumbnail; image.alt = `${event.title} poster`; image.loading = 'lazy';
    art.append(image); art.addEventListener('click', () => openEvent(event));
    const copy = el('div', undefined, 'next-copy');
    copy.append(el('span', event.dateLabel + (event.time ? ` / ${event.time}` : ''), 'next-meta'), el('h3', event.title), el('p', event.venue));
    copy.append(el('p', eventTierText(event), 'event-tier'));
    if (event.registrationUrl) copy.append(safeLink(event.registrationUrl, 'REGISTER NOW ↗', 'button red'));
    else { const details = el('button', 'VIEW EVENT DETAILS ↗', 'button outline'); details.addEventListener('click', () => openEvent(event)); copy.append(details); }
    card.append(art, copy); return card;
  }));
  if (!list.length) $('upcoming-grid').append(el('p', 'The next event is on its way. Join the WhatsApp community for announcements.', 'no-upcoming'));
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  archiveFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  renderArchive();
}));
$('weekly-toggle').addEventListener('click', () => { weeklyExpanded = !weeklyExpanded; renderWeekly(); });

function renderRankings() {
  const query = $('player-search').value.trim().toLocaleLowerCase();
  const matches = rankings.filter(p => `${p.name} ${p.id}`.toLocaleLowerCase().includes(query));
  $('ranking-body').replaceChildren(...matches.map(player => {
    const row = el('tr'), who = el('td');
    const button = el('button', player.name, 'rank-player');
    button.addEventListener('click', () => {
      resetDialog(`${season.name} / PLAYER RESULTS`, player.name, `${player.id} · Rank ${player.rank} · ${player.total} points`);
      $('dialog-art').append(el('p', `BEST ${season.bestResults} RESULTS COUNT`, 'eyebrow'));
      $('dialog-description').textContent = `${player.results.length} recorded events. ${player.counted.length} results counted.`;
      $('dialog-details').replaceChildren(...player.results.map(result => el('p', `${result.date} · ${result.event_id} · ${tierLabel(result.event_tier)} · Place ${result.placement} · ${result.points} pts${player.counted.includes(result) ? ' · COUNTED' : ''}`)));
      dialog.showModal();
    });
    who.append(button, el('small', player.id));
    row.append(el('td', String(player.rank).padStart(2, '0')), who, el('td', String(player.results.length)), el('td', String(player.total)));
    return row;
  }));
  const empty = $('ranking-empty'); empty.hidden = matches.length > 0;
  if (!matches.length) {
    if (rankings.length) empty.replaceChildren(el('h3', 'NO MATCHING PLAYERS'), el('p', 'Try a different name or GG player ID.'));
    else empty.replaceChildren(...Array.from(emptyTemplate.childNodes).map(n => n.cloneNode(true)));
  }
}
$('player-search').addEventListener('input', renderRankings);

async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error(`Could not load ${path}`);
  return response.json();
}
function handleHash() {
  if (!location.hash.startsWith('#event/')) { if (dialog.open) dialog.close(); return; }
  const id = location.hash.slice(7);
  const match = events.find(e => e.id === id);
  if (match) { previousHash = '#events'; openEvent(match, false); }
}
window.addEventListener('hashchange', handleHash);
window.addEventListener('popstate', handleHash);
getJSON('data/events.json').then(data => {
  events = data; renderUpcoming(); renderArchive(); renderWeekly(); handleHash();
}).catch(() => {
  for (const id of ['event-grid', 'weekly-grid', 'upcoming-grid']) $(id).replaceChildren(el('p', 'Events could not load. Please refresh or contact GG.', 'load-state'));
});
getJSON('data/supplemental.json').then(items => {
  $('supplemental-grid').replaceChildren(...items.map(item => {
    const button = el('button'); const image = el('img'); image.src = item.poster; image.alt = item.title; image.loading = 'lazy';
    button.append(image, el('span', item.title)); button.addEventListener('click', () => showMedia(item.poster, item.title, 'SUPPLEMENTARY ARTWORK / DATE UNCONFIRMED'));
    return button;
  }));
}).catch(() => { document.querySelector('.supplemental').hidden = true; });
getJSON('data/season.json').then(config => {
  season = config;
  $('season-name-label').textContent = config.name.toUpperCase();
  $('rank-footnote').textContent = `${config.status === 'active' ? 'Season format' : 'Proposed format'}: best ${config.bestResults} results count.`;
  document.querySelector('.rule-badge').textContent = `BEST ${config.bestResults} RESULTS / ONE SEASON`;
  const points = [config.points['1'], config.points['2'], config.points['3'], config.points['4'], config.points.top8, config.points.top16, config.points.participation];
  document.querySelectorAll('[data-regular]').forEach((cell,i) => { cell.textContent = points[i]; });
  document.querySelectorAll('[data-major]').forEach((cell,i) => { cell.textContent = points[i]*2; });
  renderUpcoming(); renderArchive(); renderWeekly(); if (events.length) handleHash();
  const summary = document.querySelectorAll('.rules-content summary')[1];
  summary.textContent = `Why the best ${config.bestResults} results?`;
  summary.nextElementSibling.textContent = `Your ${config.bestResults} highest-scoring valid results across Regular and Major Events count. With fewer than ${config.bestResults}, all valid results count. Beyond ${config.bestResults}, higher-scoring results replace lower-scoring ones. Participation points are not added on top of placement points.`;
  if (config.status === 'active') {
    rankings = calculateRankings(config.results, config);
    $('season-status').textContent = 'SEASON ACTIVE';
    $('season-dates').textContent = `${config.startDate || 'Start TBA'} — ${config.endDate || 'End TBA'}`;
    $('rulebook-label').textContent = 'THE RULEBOOK / SEASON RULES';
    $('rulebook-description').textContent = 'Only announced GG season points events count. Check eligibility before registering.';
  }
  renderRankings();
}).catch(() => {
  $('season-status').textContent = 'RANKINGS UNAVAILABLE';
  $('ranking-empty').replaceChildren(el('h3', 'PLEASE CHECK BACK'), el('p', 'The leaderboard could not load. Please try again later.'));
});
