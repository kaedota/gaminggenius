import {initialState, reduce, secondsLeft, resendLeft} from './model.mjs';
import {createTacAdapter} from './api-adapter.mjs';

const errors = {
  INVALID_PHONE: ['请输入有效的马来西亚手机号码。', 'Enter a valid Malaysian mobile number.'],
  TAC_INVALID_CODE: ['请输入6位数字 TAC。', 'Enter the 6-digit TAC.'],
  TAC_INVALID: ['TAC不正确，请重新输入。', 'The TAC is incorrect. Try again.'],
  TAC_EXPIRED: ['TAC已过期，请重新获取。', 'This TAC has expired. Request a new one.'],
  TAC_ATTEMPTS_EXCEEDED: ['尝试次数已达上限，请稍后重新获取。', 'Too many attempts. Wait before requesting another TAC.'],
  TAC_RATE_LIMITED: ['获取太频繁，请稍后再试。', 'Too many requests. Please wait and try again.'],
  RATE_LIMITED: ['获取太频繁，请稍后再试。', 'Too many requests. Please wait and try again.'],
  TAC_CONTEXT_CHANGED: ['本次预约内容已变化，请重新验证。', 'The booking details changed. Verify again.'],
  TAC_DETAILS_CHANGED: ['会员或预约资料已变化，请重新验证。', 'The membership or booking details changed. Verify again.'],
  TAC_ALREADY_USED: ['此TAC已使用，请重新获取。', 'This TAC has already been used. Request a new one.'],
  TAC_REPLAY: ['此TAC已使用，请重新获取。', 'This TAC has already been used. Request a new one.'],
  MEMBER_REVIEW_REQUIRED: ['会员资料需要店员核实，请联系店员。', 'Staff need to review this membership. Please contact the store.'],
  INSUFFICIENT_MEMBER_FUNDS: ['会员余额或积分不足，请选择其他付款方式。', 'The membership has insufficient balance or points. Choose another payment method.'],
  TAC_RESPONSE_INVALID: ['验证结果未能核对，请重试或联系店员。', 'The result could not be confirmed. Retry or contact staff.'],
  TAC_DISABLED: ['短信验证测试尚未开放。', 'SMS verification testing is not open yet.'],
  TAC_NOT_OPEN: ['短信验证测试尚未开放。', 'SMS verification testing is not open yet.'],
  TAC_LIVE_DISABLED: ['当前仅限获准账号进行不扣款测试。', 'Only approved accounts can use this test. No charge is enabled.'],
  TAC_TEST_PHONE_NOT_ALLOWED: ['这个号码未加入测试名单，请联系店员。', 'This number is not on the test list. Please contact staff.'],
  SMS_PAYMENT_PURPOSE_NOT_APPROVED: ['会员付款短信尚未开放，请暂用其他付款方式。', 'Membership payment SMS is not enabled yet. Use another payment method for now.'],
  TAC_SERVICE_UNAVAILABLE: ['验证服务暂时不可用，请稍后再试。', 'Verification is temporarily unavailable. Please try later.'],
  SMS_UNAVAILABLE: ['短信暂时无法发送，请稍后再试。', 'SMS is temporarily unavailable. Please try later.'],
  SMS_DELIVERY_UNKNOWN: ['发送状态正在核对，请稍后查看，勿连续重发。', 'Delivery status is being checked. Wait before retrying.'],
  TAC_UNAVAILABLE: ['操作未完成，请稍后再试。', 'The request could not be completed. Try again later.']
};
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const maskPhone = phone => phone.length > 7 ? phone.slice(0, 5) + '••••' + phone.slice(-4) : phone;
const clock = seconds => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
const minutes = value => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
const money = value => 'RM ' + (Number(value) / 100).toFixed(2);

export function mountTacFlow(root, {call, context, language = 'zh', demo = false, demoHint = '', now = () => Date.now()}) {
  const api = createTacAdapter(call);
  let state = initialState(context), lang = language, disposed = false;
  const t = (zh, en) => lang === 'zh' ? zh : en;
  const dispatch = event => {state = reduce(state, event, now()); return state;};
  function button(text, handler, secondary = false) {
    const element = node('button', text, secondary ? 'gg-tac-button secondary' : 'gg-tac-button');
    element.type = 'button'; element.disabled = state.busy; element.onclick = handler;
    return element;
  }
  function note(text) { return node('p', text, 'gg-tac-note'); }
  function currentError() { const pair = errors[state.error] || errors.TAC_UNAVAILABLE; return t(...pair); }
  function reset() { dispatch({type: 'RESET'}); render(); }
  async function send(phone, resend = false) {
    if (disposed || state.busy) return;
    const next = dispatch({type: 'BEGIN_START', phone, requestId: crypto.randomUUID(), resend});
    if (!next.busy || next.operation !== 'start') {render(); return;}
    const epoch = next.epoch;
    const payload = {phone: next.phone, purpose: next.context.purpose, request_id: next.requestId};
    if (next.context.booking) payload.booking = {...next.context.booking};
    render();
    try { dispatch({type: 'STARTED', epoch, response: await api('start_tac', payload)}); }
    catch (error) { dispatch({type: 'FAILED', epoch, code: error?.message}); }
    if (!disposed) render();
  }
  async function verify(code) {
    if (disposed || state.busy) return;
    dispatch({type: 'BEGIN_VERIFY', code});
    if (!state.busy || state.operation !== 'verify') {render(); return;}
    const epoch = state.epoch, challengeId = state.challenge.id;
    render();
    try { dispatch({type: 'VERIFIED', epoch, response: await api('verify_tac', {challenge_id: challengeId, code})}); }
    catch (error) { dispatch({type: 'FAILED', epoch, code: error?.message}); }
    if (!disposed) render();
  }
  async function confirm() {
    if (disposed || state.busy) return;
    dispatch({type: 'BEGIN_CONFIRM'});
    if (!state.busy || state.operation !== 'confirm') return;
    const epoch = state.epoch, payload = {challenge_id: state.challenge.id, request_id: state.requestId};
    render();
    try { dispatch({type: 'COMPLETED', epoch, response: await api('read_tac_result', payload)}); }
    catch (error) { dispatch({type: 'FAILED', epoch, code: error?.message}); }
    if (!disposed) render();
  }
  function renderBooking(parent) {
    const booking = state.context.booking;
    if (!booking) return;
    const box = node('div', undefined, 'gg-tac-booking');
    box.append(node('strong', booking.station), node('span', `${booking.date} · ${minutes(booking.startMinute)}–${minutes(booking.startMinute + booking.minutes)}`),
      node('span', t(`${booking.people}位玩家 · ${booking.minutes}分钟`, `${booking.people} players · ${booking.minutes} minutes`)));
    parent.append(box);
  }
  function renderReview(parent) {
    const review = state.review;
    if (!review || !['review', 'done'].includes(state.phase)) return;
    const box = node('div', undefined, 'gg-tac-member');
    box.append(node('span', t('已验证的会员', 'Verified membership'), 'gg-tac-overline'), node('h3', review.member.name),
      note(t('会员编号：', 'Member number: ') + review.member.number));
    const stats = node('div', undefined, 'gg-tac-stats');
    for (const [label, value] of [[t('储值余额', 'Balance'), 'RM ' + review.member.balance.toFixed(2)], [t('积分', 'Points'), String(review.member.points)]]) {
      const item = node('div'); item.append(node('span', label), node('strong', value)); stats.append(item);
    }
    box.append(stats);
    if (review.quote) {
      const total = node('div', undefined, 'gg-tac-total');
      total.append(node('span', t('本次预约金额', 'Booking total')), node('strong', money(review.quote.cents)));
      box.append(total);
      if (state.context.purpose === 'booking_points') box.append(note(t('拟使用积分：', 'Points required: ') + review.quote.points));
    }
    parent.append(box);
  }
  function updateClock() {
    const counter = root.querySelector('[data-tac-clock]');
    if (counter) counter.textContent = clock(secondsLeft(state, now()));
    const resend = root.querySelector('[data-tac-resend]');
    if (resend) { const remaining = resendLeft(state, now()); resend.disabled = state.busy || remaining > 0;
      resend.textContent = remaining ? t(`${remaining}秒后可重发`, `Resend in ${remaining}s`) : t(demo ? '重新演示发送' : '重新发送 TAC', demo ? 'Simulate resend' : 'Resend TAC'); }
    const verifyButton = root.querySelector('[data-tac-verify]');
    if (verifyButton) verifyButton.disabled = state.busy || secondsLeft(state, now()) === 0;
  }
  function render() {
    if (disposed) return;
    root.replaceChildren(); root.className = 'gg-tac';
    if (state.phase === 'auth') { root.append(node('h2', t('请先登录 GG', 'Sign in to GG first')), note(t('已清除本页会员资料与验证结果。', 'Membership details and verification results have been cleared.'))); return; }
    const step = state.phase === 'phone' ? 1 : state.phase === 'code' ? 2 : 3;
    const steps = node('ol', undefined, 'gg-tac-steps');
    for (const [index, text] of [t('手机号码', 'Phone'), 'TAC', t('核对会员', 'Review membership')].entries()) {
      const item = node('li', `${index + 1}  ${text}`, index + 1 === step ? 'active' : '');
      if (index + 1 === step) item.setAttribute('aria-current', 'step'); steps.append(item);
    }
    root.append(steps);
    const card = node('section', undefined, 'gg-tac-card');
    card.append(node('p', 'GG MEMBER', 'gg-tac-overline'), node('h2', state.phase === 'done' ? t('验证完成', 'Verification complete') : t('只读会员TAC测试', 'Read-only membership TAC test')));
    card.append(node('p', demo ? t('界面演示：不发送短信、不扣款、不建立真实预约。', 'Interface demo: no SMS, no charge and no real booking.') :
      t('真实短信 · 只读会员核对。不绑定、不扣款、不建立预约。', 'Real SMS · Read-only membership review. No link, debit or booking.'), 'gg-tac-banner'));
    if (state.phase === 'phone') {
      renderBooking(card);
      card.append(note(t('输入你在 GG 登记的会员手机号。验证通过后才显示会员资料。', 'Enter the mobile number registered with GG. Membership details appear only after verification.')));
      const form = node('form'), label = node('label', t('会员手机号码', 'Member mobile number'));
      const input = node('input'); input.id = 'gg-tac-phone'; input.type = 'tel'; input.inputMode = 'tel'; input.autocomplete = 'tel'; input.maxLength = 32; input.value = state.phone; input.placeholder = '012-345 6789'; input.required = true; input.disabled = state.busy; label.append(input);
      const submit = button(state.busy ? t('处理中…', 'Processing…') : t(demo ? '演示发送 TAC' : '发送 TAC', demo ? 'Simulate TAC request' : 'Send TAC'), () => {});
      submit.type = 'submit'; form.append(label, submit); form.onsubmit = event => {event.preventDefault(); void send(input.value);}; card.append(form);
      card.append(note(t('TAC有效期5分钟，每次验证只能使用一次。', 'TACs expire after 5 minutes and can be used once.')));
    } else if (state.phase === 'code') {
      card.append(note(t(demo ? '已模拟发送至 ' : '验证码发送号码：', demo ? 'Simulated request for ' : 'Code destination: ') + maskPhone(state.phone)));
      const timer = node('p', undefined, 'gg-tac-timer'); timer.append(document.createTextNode(t('剩余有效时间 ', 'Time remaining ')));
      const value = node('strong', clock(secondsLeft(state, now()))); value.dataset.tacClock = ''; timer.append(value); card.append(timer);
      const form = node('form'), label = node('label', t('6位 TAC', '6-digit TAC')), input = node('input');
      input.id = 'gg-tac-code'; input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'one-time-code'; input.pattern = '[0-9]{6}'; input.maxLength = 6; input.required = true; input.disabled = state.busy;
      input.placeholder = '••••••'; input.addEventListener('input', () => {input.value = input.value.replace(/\D/g, '').slice(0, 6);}); label.append(input);
      const submit = button(state.busy ? t('验证中…', 'Verifying…') : t('验证并查看会员', 'Verify & view membership'), () => {}); submit.type = 'submit'; submit.dataset.tacVerify = '';
      form.append(label, submit); form.onsubmit = event => {event.preventDefault(); const code = input.value; input.value = ''; void verify(code);}; card.append(form);
      if (demo && demoHint) card.append(node('p', t('仅此演示的测试码：', 'Demo-only test code: ') + demoHint, 'gg-tac-demo-hint'));
      const actions = node('div', undefined, 'gg-tac-actions'), resend = button('', () => void send(state.phone, true), true); resend.dataset.tacResend = '';
      actions.append(resend, button(t('更换号码', 'Change number'), reset, true)); card.append(actions);
    } else {
      renderReview(card);
      if (state.phase === 'review') {
        renderBooking(card);
        card.append(note(t('请核对会员资料。完成只读核对不会绑定会员、扣款或建立预约。', 'Review the membership details. Completing this read-only check does not link membership, debit funds or create a booking.')),
          button(state.busy ? t('核对中…', 'Checking…') : t('完成只读核对', 'Complete read-only check'), () => void confirm()), button(t('重新验证', 'Start again'), reset, true));
      } else {
        const success = node('div', undefined, 'gg-tac-success');
        success.append(node('strong', t('✓ 会员资料已核对', '✓ Membership details checked')), note(t('未绑定 · 未扣款 · 未建立预约', 'No membership link · No debit · No booking'))); card.append(success);
        card.append(button(t('重新验证', 'Verify again'), reset, true));
      }
    }
    const status = node('p', state.error ? currentError() : '', 'gg-tac-error'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); card.append(status);
    root.append(card); updateClock();
  }
  const interval = setInterval(() => {if (disposed) return; const previous = state; dispatch({type: 'TICK'}); if (previous.error !== state.error) render(); else updateClock();}, 500);
  render();
  return {
    setLanguage(value) {lang = value === 'en' ? 'en' : 'zh'; render();},
    setContext(value) {dispatch({type: 'CONTEXT', context: value}); render();},
    signOut() {dispatch({type: 'SIGNED_OUT'}); render();},
    dispose() {dispatch({type: 'DISPOSE'}); disposed = true; clearInterval(interval); root.replaceChildren();}
  };
}
