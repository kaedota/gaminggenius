export function selectFeaturedFilm(events, today) {
  const event = events.find(e => e.homepagePromo && e.endDate >= today && e.videos?.some(v => v.src === e.homepagePromo));
  return event ? {event, film:event.videos.find(v => v.src === event.homepagePromo)} : null;
}
export function renderFeaturedFilm(events, today, openEvent, dialog) {
  const section = document.getElementById('featured-film');
  const selected = selectFeaturedFilm(events, today);
  if (!selected) return;
  const {event, film} = selected;
  const copy = document.createElement('div');
  copy.innerHTML = '<p class="eyebrow">GG PRESENTS / FEATURED EVENT</p><h2></h2><p class="feature-meta"></p><button class="button red">VIEW EVENT ↗</button><div class="feature-controls"><button class="button outline" id="feature-play">PLAY VIDEO</button><button class="button outline" id="feature-sound">TURN SOUND ON</button></div><p class="feature-note">Muted preview · Sound is optional.</p>';
  copy.querySelector('h2').textContent = event.title;
  copy.querySelector('.feature-meta').textContent = event.dateLabel + ' · ' + event.venue;
  copy.querySelector('.button.red').addEventListener('click', () => openEvent(event));
  const frame = document.createElement('div'); frame.className = 'feature-player';
  const video = document.createElement('video');
  video.muted = true; video.defaultMuted = true; video.loop = true;
  video.playsInline = true; video.controls = true; video.preload = 'none'; video.poster = film.poster;
  video.setAttribute('aria-label', film.title + ' · Homepage preview');
  const source = document.createElement('source'); source.src = film.src; source.type = film.type || 'video/mp4'; video.append(source);
  frame.append(video); section.replaceChildren(copy, frame); section.hidden = false;
  const play = copy.querySelector('#feature-play'), sound = copy.querySelector('#feature-sound');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, userPaused = false;
  const eligible = () => visible && !document.hidden && !dialog.open;
  function sync() {
    if (!eligible()) video.pause();
    else if (!userPaused && !reduced.matches && video.muted) video.play().catch(() => {});
  }
  video.addEventListener('play', () => { play.textContent = 'PAUSE VIDEO'; userPaused = false; });
  video.addEventListener('pause', () => { play.textContent = 'PLAY VIDEO'; if (eligible()) userPaused = true; });
  video.addEventListener('volumechange', () => { sound.textContent = video.muted ? 'TURN SOUND ON' : 'MUTE SOUND'; });
  play.addEventListener('click', () => { if (video.paused) { userPaused = false; video.play().catch(() => {}); } else { userPaused = true; video.pause(); } });
  sound.addEventListener('click', () => { video.muted = !video.muted; });
  video.addEventListener('error', () => { copy.querySelector('.feature-note').textContent = 'Preview unavailable. Open the event for the video link.'; });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, {threshold:0.25}).observe(section);
  new MutationObserver(sync).observe(dialog, {attributes:true, attributeFilter:['open']});
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { if (reduced.matches) video.pause(); else sync(); });
}
