// Presentation only: preserve the existing auth handlers and account visibility.
const profile = document.getElementById('competition-profile');
const account = document.getElementById('account');
let waitingForAccount = false;

function revealProfileTarget() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!profile || !target || !(target === profile || profile.contains(target))) {
    waitingForAccount = false;
    return;
  }
  for (let element = target; element; element = element.parentElement) {
    if (element.tagName === 'DETAILS') element.open = true;
    if (element === profile) break;
  }
  waitingForAccount = !!account?.hidden && account.contains(target);
  if (!waitingForAccount) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}
window.addEventListener('hashchange', revealProfileTarget);
if (account) new MutationObserver(() => {
  if (waitingForAccount && !account.hidden) revealProfileTarget();
}).observe(account, { attributes: true, attributeFilter: ['hidden'] });
revealProfileTarget();

// The existing app owns the selected auth mode; reflect its controls visually.
const modeButtons = [...document.querySelectorAll('#account-functions [data-mode]')];
function markMode(mode) {
  modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
}
const requestedMode = new URL(location.href).searchParams.get('mode');
markMode(requestedMode === 'signup' ? 'signup' : 'login');
modeButtons.forEach(button => button.addEventListener('click', () => markMode(button.dataset.mode)));

