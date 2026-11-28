// Presentation follows the existing app's hidden flags; it never changes access.
const account = document.getElementById('account');
const title = document.getElementById('player-title');
const staff = document.getElementById('staff-access');
const mfa = document.getElementById('mfa');
const admin = document.getElementById('admin');
const titleNodes = [...title.childNodes].map(node => node.cloneNode(true));
const originalNoTranslate = title.hasAttribute('data-no-translate');
let wasSignedIn = false;

function isHidden(target) {
  for (let node = target; node; node = node.parentElement) {
    if (node.hidden) return true;
  }
  return false;
}

// Hash links open only the requested panel, once its existing access gate permits it.
function openAccountTarget() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id) return;
  const target = document.getElementById(id);
  if (!target || isHidden(target)) return;
  if (!account.contains(target) && !staff.contains(target)) return;
  for (let parent = target; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
  requestAnimationFrame(() => {
    if (isHidden(target)) return;
    target.scrollIntoView({ block: 'start' });
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
      target.focus({ preventScroll: true });
    }
  });
}

function syncPresentation() {
  const signedIn = !account.hidden;
  const english = document.documentElement.lang === 'en';
  if (signedIn) {
    title.setAttribute('data-no-translate', '');
    const label = english ? 'My account' : '我的账号';
    if (title.textContent !== label) title.textContent = label;
  } else if (wasSignedIn) {
    title.replaceChildren(...titleNodes.map(node => node.cloneNode(true)));
    if (!originalNoTranslate) title.removeAttribute('data-no-translate');
  }
  wasSignedIn = signedIn;

  const labels = {
    records: english ? 'My competition records' : '我的比赛记录',
    staff: english ? 'Staff access' : '工作人员入口',
  };
  for (const node of document.querySelectorAll('[data-account-label]')) {
    const label = labels[node.dataset.accountLabel];
    if (node.textContent !== label) node.textContent = label;
  }

  const hideStaff = mfa.hidden && admin.hidden;
  if (staff.hidden !== hideStaff) staff.hidden = hideStaff;
  if (hideStaff) staff.open = false;
  // Password recovery already requires this visible MFA step before saving.
  if (account.hidden && !mfa.hidden) staff.open = true;
  if (!signedIn) {
    for (const panel of account.querySelectorAll('details')) panel.open = false;
  }
}

syncPresentation();
openAccountTarget();
const stateObserver = new MutationObserver(() => {
  syncPresentation();
  openAccountTarget();
});
for (const node of [account, mfa, admin]) {
  stateObserver.observe(node, { attributes: true, attributeFilter: ['hidden'] });
}
const languageObserver = new MutationObserver(syncPresentation);
languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
window.addEventListener('gg-language-change', syncPresentation);
window.addEventListener('hashchange', openAccountTarget);
