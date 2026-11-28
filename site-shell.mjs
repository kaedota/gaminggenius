// Shared presentation only. Existing page modules own authentication and bookings.
export const navigation = Object.freeze([
  ['EVENTS', 'index.html#events'],
  ['GG RANKINGS', 'index.html#ranking'],
  ['LIVE', 'live.html'],
  ['SHOP', 'shop.html'],
  ['BOOK GAMING', 'member-test/booking.html'],
  ['PLAY PASSES', 'member-test/play-passes.html'],
  ['OUR STORY', 'index.html#about'],
  ['JOIN THE COMMUNITY', 'index.html#connect'],
].map(Object.freeze));

export function signInUrl(siteRoot, pageUrl) {
  const url = new URL('member-test/index.html?mode=login', siteRoot);
  const page = new URL(pageUrl).pathname;
  if (page.endsWith('/member-test/booking.html')) url.searchParams.set('from', 'booking');
  if (page.endsWith('/member-test/play-passes.html')) url.searchParams.set('from', 'passes');
  return url.href;
}

const accountCopy = [
  ['登录', 'Sign in'], ['注册', 'Register'], ['退出登录', 'Sign out'],
  ['正在退出…', 'Signing out…'], ['我的档案', 'My profile'],
  ['查看账号', 'View account'], ['账号状态暂时无法确认', 'Account status is temporarily unavailable'],
];

export function accountLabel(value, language) {
  const pair = accountCopy.find(pair => pair.includes(value));
  if (pair) return pair[language === 'en' ? 1 : 0];
  const signed = value.match(/^(?:已登录 · |Signed in · )(.+)$/s);
  return signed ? (language === 'en' ? 'Signed in · ' : '已登录 · ') + signed[1] : value;
}

export function mountSiteShell({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  siteRoot = new URL('./', import.meta.url),
} = {}) {
  const existing = doc.getElementById('gg-site-shell');
  if (existing?.dataset.ggShellMounted === 'true') return existing;
  const create = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const shell = existing || create('div');
  shell.classList.add('gg-site-shell');
  shell.id = 'gg-site-shell';
  shell.dataset.ggShellMounted = 'true';
  shell.setAttribute('role', 'banner');
  const inner = create('div', 'gg-shell-inner');
  const brand = create('a', 'gg-shell-brand');
  brand.href = new URL('index.html', siteRoot).href;
  brand.setAttribute('aria-label', 'Gaming Genius home');
  const logo = create('img');
  logo.src = new URL('assets/gg-logo.png', siteRoot).href;
  logo.width = 100;
  logo.height = 78;
  logo.alt = 'Gaming Genius original logo';
  const wordmark = create('span', '', 'GAMING GENIUS');
  wordmark.append(create('small', '', 'PLAY · COMPETE · BELONG'));
  brand.append(logo, wordmark);
  const nav = create('nav', 'gg-shell-nav');
  nav.setAttribute('aria-label', 'Main navigation');
  for (const [label, path] of navigation) {
    const link = create('a', label === 'JOIN THE COMMUNITY' ? 'gg-shell-community' : '', label);
    link.href = new URL(path, siteRoot).href;
    link.dataset.ggShellNav = '';
    if (label === 'PLAY PASSES') link.dataset.noTranslate = '';
    if (label === 'JOIN THE COMMUNITY') {
      const arrow = create('span', '', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      link.append(arrow);
    }
    nav.append(link);
  }
  inner.append(brand, nav);
  shell.append(inner);
  if (!existing) doc.body.prepend(shell);

  const slot = create('div', 'gg-shell-account');
  const fallback = create('a', 'gg-shell-signin');
  fallback.href = signInUrl(siteRoot, win.location.href);
  slot.append(fallback);
  let bookingLink = null;
  let language = doc.documentElement.lang === 'en' ? 'en' : 'zh';
  let queued = false;
  let syncingLanguage = false;

  // Let the original listener remember the selected station/time, including for
  // modified clicks. The visible link then performs the requested navigation.
  fallback.addEventListener('click', () => {
    if (!bookingLink?.isConnected) return;
    const preventNativeNavigation = event => event.preventDefault();
    bookingLink.addEventListener('click', preventNativeNavigation, { once: true });
    try { bookingLink.click(); }
    finally { bookingLink.removeEventListener('click', preventNativeNavigation); }
  });

  function nativeHeaders() {
    return Array.from(doc.querySelectorAll('body > header, #app > header'));
  }

  function syncNativeLanguage(value) {
    if (syncingLanguage) return;
    syncingLanguage = true;
    try {
      for (const header of nativeHeaders()) {
        const button = header.querySelector('[data-lang="' + value + '"]');
        if (button && button.getAttribute('aria-pressed') !== 'true') button.click();
      }
    } finally { syncingLanguage = false; }
  }

  function translateAccount(root) {
    const walker = doc.createTreeWalker(root, 4);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = accountLabel(node.nodeValue, language);
      if (text !== node.nodeValue) node.nodeValue = text;
    }
    for (const node of root.querySelectorAll('[title]')) {
      const title = node.getAttribute('title');
      const text = accountLabel(title, language);
      if (text !== title) node.setAttribute('title', text);
    }
  }

  function update() {
    queued = false;
    const bar = doc.querySelector('.gg-language');
    // Keep the original headers visible if the shared language toolbar failed.
    if (!bar) return;
    bar.classList.add('gg-shell-toolbar');
    if (slot.parentElement !== bar) bar.append(slot);
    if (shell.previousElementSibling !== bar) bar.after(shell);
    const selected = bar.querySelector('[data-gg-lang][aria-pressed="true"]');
    if (selected) language = selected.dataset.ggLang;

    const account = doc.getElementById('site-account') || doc.getElementById('member-account');
    if (account && account.parentElement !== slot) slot.prepend(account);
    bookingLink = doc.querySelector('#app > header .account-link');
    const hasAccount = !!account?.textContent.trim();
    fallback.hidden = hasAccount;
    const passSignedIn = !!doc.querySelector('#app .page-intro > .signed');
    const walletSignedIn = !!doc.querySelector('.gg-member-account');
    fallback.href = bookingLink?.href || (passSignedIn || walletSignedIn
      ? new URL('member-test/index.html', siteRoot).href
      : signInUrl(siteRoot, win.location.href));
    const bookingSignedIn = bookingLink && !bookingLink.hasAttribute('data-booking-login');
    const text = bookingSignedIn || passSignedIn || walletSignedIn
      ? (language === 'en' ? 'Signed in · Account' : '已登录 · 会员中心')
      : (language === 'en' ? 'Sign in' : '登录');
    if (fallback.textContent !== text) fallback.textContent = text;
    if (account) translateAccount(account);

    for (const header of nativeHeaders()) {
      header.dataset.ggShellReplaced = '';
      // Booking and passes render their language state into aria-pressed.
      const active = header.querySelector('[data-lang][aria-pressed="true"]');
      if (active && active.dataset.lang !== language) syncNativeLanguage(language);
    }
    doc.documentElement.classList.add('gg-shell-ready');
  }

  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(update);
  }
  const observer = new win.MutationObserver(schedule);
  observer.observe(doc.body, { childList: true, characterData: true, subtree: true });
  win.addEventListener('gg-language-change', event => {
    const value = event.detail?.language;
    if (value !== 'en' && value !== 'zh') return;
    language = value;
    syncNativeLanguage(value);
    update();
  });
  win.addEventListener('storage', event => {
    if (event.key === 'gg-language' && ['zh', 'en'].includes(event.newValue)) {
      language = event.newValue;
      // A change in another tab must never trigger the wallet's reload handler.
      update();
    }
  });
  update();
  return shell;
}

if (typeof document !== 'undefined') {
  const start = () => mountSiteShell();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
