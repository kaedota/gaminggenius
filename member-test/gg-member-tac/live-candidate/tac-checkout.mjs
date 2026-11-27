import {createLiveController,hasAnyRecovery} from './live-controller.mjs?v=owner-live-v2';

const element = (tag, text, className) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n;};
const rm = cents => 'RM ' + (cents / 100).toFixed(2);
const errors = {
  INVALID_PHONE: ['请输入有效的马来西亚手机号。', 'Enter a valid Malaysian mobile number.'],
  TAC_INVALID_CODE: ['请输入6位数字。', 'Enter the 6-digit TAC.'],
  TAC_INVALID: ['TAC不正确或已失效，请重新核对。', 'The TAC is incorrect or no longer valid.'],
  TAC_EXPIRED: ['TAC已过期，请重新验证。', 'The TAC expired. Verify again.'],
  RATE_LIMITED: ['请稍后再获取TAC。', 'Wait before requesting another TAC.'],
  TAC_VERIFY_AGAIN: ['未提交付款。请重新获取TAC，核对后再确认。', 'No payment was submitted. Request a new TAC and review the amount again.'],
  TAC_CONTEXT_CHANGED:['原请求已保留；预约内容变化后不能沿用原TAC付款。请核对原请求。','The original request is retained. Changed booking details cannot use its TAC. Review the original request.'],
  TAC_RECOVERY_REQUIRED:['请只查询原请求；不会自动发新短信或扣款。','Read the original request only. No new SMS or debit is automatic.'],
  TAC_VERIFY_RESULT_UNKNOWN:['验证回复未确认，请只查询原请求；不会自动重发或付款。','The verification reply is unconfirmed. Read the original request only; no automatic resend or payment.'],
  PAYMENT_REVIEW_REQUIRED: ['结果待核对，请联系店员，不要再次付款。', 'The result needs review. Contact staff and do not pay again.'],
  BOOKING_REVIEW_REQUIRED:['已扣款，预约状态需要店员核对。请勿再次付款。','Funds were debited; the booking status needs staff review. Do not pay again.'],
  RECOVERY_STORAGE_REVIEW:['本地核对记录格式异常，请联系店员查看后台；不要再次付款。','The local recovery record needs staff review. Check the server records and do not pay again.'],
  RECOVERY_STORAGE_UNAVAILABLE: ['无法保存安全核对记录，暂时不能扣款。请检查浏览器设置。', 'The recovery record could not be saved. Payment is blocked. Check browser settings.'],
  INSUFFICIENT_MEMBER_FUNDS: ['余额或积分不足，请选择其他付款方式。', 'Insufficient balance or points. Choose another payment method.'],
  TAC_DETAILS_CHANGED: ['会员或金额已变化，请联系店员核对。', 'The membership or amount changed. Contact staff for review.'],
  TAC_TEST_PHONE_NOT_ALLOWED: ['该号码未加入验收名单。', 'This number is not approved for acceptance testing.'],
  TAC_LIVE_DISABLED: ['会员TAC付款候选尚未开放。', 'The candidate membership TAC checkout is disabled.'],
  TAC_NOT_OPEN: ['会员TAC付款候选尚未开放。', 'The candidate membership TAC checkout is disabled.'],
  TAC_LIVE_NOT_OPEN: ['会员TAC付款候选尚未开放。', 'The candidate membership TAC checkout is disabled.'],
  SMS_PAYMENT_PURPOSE_NOT_APPROVED: ['会员付款短信尚未获准启用。', 'Membership payment SMS has not been approved for activation.']
};

export function mountLiveTacCheckout(root, {call, context, userId, enabled = false, ownerAcceptance = false,
  language = 'zh', userEmail='',store,readOnly=false,onSettled=()=>{},onBusyChange=()=>{},onRecoveryLockChange=()=>{},testingHarness=false}) {
  let lang = language === 'en' ? 'en' : 'zh', controller, disposed = false, current;
  const t = (zh, en) => lang === 'zh' ? zh : en;
  if (store === undefined) {try {store = sessionStorage;} catch {store = null;}}
  function button(text, action, secondary = false) {
    const b = element('button', text, secondary ? 'gg-tac-button secondary' : 'gg-tac-button');
    b.type = 'button'; b.disabled = current.busy; b.addEventListener('click', () => void action()); return b;
  }
  function note(text) {return element('p', text, 'gg-tac-note');}
  function booking(parent, data) {
    if (!data) return;
    const box = element('div', undefined, 'gg-tac-booking');
    box.append(element('strong', data.station), element('span', data.date),
      element('span', t(`开始 ${Math.floor(data.startMinute / 60)}:${String(data.startMinute % 60).padStart(2, '0')} · ${data.minutes}分钟 · ${data.people}人`,
        `Starts ${Math.floor(data.startMinute / 60)}:${String(data.startMinute % 60).padStart(2, '0')} · ${data.minutes} min · ${data.people} players`)));
    parent.append(box);
  }
  function clock() {
    if (!controller || disposed) return;
    const value = controller.view;
    const timer = root.querySelector('[data-live-clock]');
    if (timer) timer.textContent = t(`TAC剩余 ${value.secondsLeft}秒`, `TAC expires in ${value.secondsLeft}s`);
    const resend = root.querySelector('[data-live-resend]');
    if (resend) {resend.disabled=true;resend.textContent=t('本次请求不重发短信','No SMS resend for this request');}
    const verify = root.querySelector('[data-live-verify]'); if (verify) verify.disabled = value.busy || value.secondsLeft === 0;
    const pay = root.querySelector('[data-live-pay]'); if (pay) pay.disabled = value.busy || value.secondsLeft === 0;
  }
  function render(s) {
    current = s; root.replaceChildren(); root.className = 'gg-tac';
    onBusyChange(s.busy);
    onRecoveryLockChange(s.phase!=='settled'&&(s.sendAttempted||s.attempted||hasAnyRecovery(store,userId)));
    const card = element('section', undefined, 'gg-tac-card');
    card.append(element('p', 'OWNER ACCEPTANCE CANDIDATE', 'gg-tac-overline'));
    if(typeof userEmail==='string'&&userEmail.includes('@'))card.append(note(t('GG 登录账号：','GG signed-in account: ')+userEmail));
    if (s.phase === 'disabled' || s.phase === 'auth') {
      card.append(element('h3', t(s.phase === 'auth' ? '请重新登录GG' : '会员TAC付款尚未开放', s.phase === 'auth' ? 'Sign in to GG again' : 'Membership TAC checkout is disabled')),
        note(t('当前验收访问未通过，不会发送短信或扣款。', 'Acceptance access is not approved. No SMS or debit is started.')));
      root.append(card); return;
    }
    card.append(element('h3', t('验证会员并付款', 'Verify membership and pay')),
      element('p',readOnly?t('金融入口已关闭，仅只读核对原请求，不会发新短信或再次扣款。','Financial entry is closed. This only reads the original request; no new SMS or debit.'):testingHarness?t('隔离演示：以下只模拟验证和付款，不发送短信、不扣款、不建立预约。','Isolated demo: verification and payment are simulated. No SMS, debit or booking.'):t('仅供Owner验收。确认付款会使用真实会员余额或积分。','Owner acceptance only. Confirming payment uses real membership balance or points.'),'gg-tac-banner'));
    booking(card, s.context.booking);
    if (s.phase === 'phone') {
      card.append(note(t('验证通过后才显示姓名、余额、积分与应付金额。', 'The name, balance, points and payable amount appear only after verification.')));
      const label = element('label', t('会员手机号', 'Member mobile number')), phone = element('input');
      phone.type = 'tel'; phone.inputMode = 'tel'; phone.autocomplete = 'tel'; phone.maxLength = 32; phone.value = s.phone; phone.placeholder = '012-345 6789'; phone.disabled = s.busy;
      label.append(phone); card.append(label, button(s.busy ? t('发送并核对中（最多约2分钟）…', 'Sending and checking (up to 2 minutes)…') : t('发送TAC', 'Send TAC'), () => controller.start(phone.value)));
    } else if (s.phase === 'code') {
      const masked = s.phone ? s.phone.slice(0, 5) + '••••' + s.phone.slice(-4) : t('本次验证号码', 'the verification number');
      card.append(note(t('原请求号码：', 'Original request number: ') + masked));
      const timer = note(''); timer.dataset.liveClock = ''; card.append(timer);
      const label = element('label', t('6位TAC', '6-digit TAC')), code = element('input');
      code.type = 'text'; code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.maxLength = 6; code.disabled = s.busy;
      code.addEventListener('input', () => {code.value = code.value.replace(/\D/g, '').slice(0, 6);}); label.append(code);
      const verify = button(s.busy ? t('验证中…', 'Verifying…') : t('验证并查看金额', 'Verify and view amount'), () => {const value = code.value; code.value = ''; return controller.verify(value);}); verify.dataset.liveVerify = '';
      const resend = button('', () => controller.start(s.phone, {resend: true}), true); resend.dataset.liveResend = '';
      card.append(label, verify, resend, button(t('只查询原请求状态', 'Read original request status'), () => controller.read(), true));
    } else if (s.phase === 'review') {
      const {member, quote} = s.review;
      const box = element('div', undefined, 'gg-tac-member');
      box.append(element('strong', member.name), note(t('会员编号：', 'Member number: ') + member.number),
        note(t('余额：', 'Balance: ') + 'RM ' + member.balance.toFixed(2) + t(' · 积分：', ' · Points: ') + member.points));
      const total = element('div', undefined, 'gg-tac-total'); total.append(element('span', t('服务器确认金额', 'Server-confirmed total')), element('strong', rm(quote.cents))); box.append(total);
      const usingPoints = s.context.purpose === 'booking_points';
      if (usingPoints) box.append(note(t('将扣积分：', 'Points to debit: ') + quote.points)); card.append(box);
      const label = t(usingPoints ? `确认扣${quote.points}积分并预约` : `确认扣款 ${rm(quote.cents)} 并预约`, usingPoints ? `Confirm ${quote.points} points & book` : `Confirm ${rm(quote.cents)} debit & book`);
      const pay = button((testingHarness ? t('模拟 · ', 'Simulate · ') : '') + label, () => controller.pay()); pay.dataset.livePay = '';
      card.append(note(testingHarness ? t('此按钮仅模拟提交，不会扣款或创建真实预约。', 'This button only simulates submission. No debit or real booking occurs.') : t('点击下方才会提交真实扣款。金额或时间有误，请重新验证。', 'The button below submits a real debit. Verify again if the amount or session is incorrect.')), pay,
        button(t('暂不付款，核对原请求', 'Do not pay; review original request'), () => controller.restart(), true));
    } else if (s.phase === 'settled') {
      card.append(element('strong', testingHarness ? t('模拟结果已确认 · 没有真实扣款或预约', 'Simulated result confirmed · No real debit or booking') : t('会员付款成功，预约已确认。', 'Member payment succeeded. Booking confirmed.'), 'gg-tac-success'),
        note(t('预约编号：', 'Booking ID: ') + s.intent.booking_id), note(t('交易编号：', 'Transaction ID: ') + s.intent.id));
    } else if (s.phase === 'linked') {
      card.append(element('strong', t('会员已通过TAC验证并绑定。', 'Membership verified by TAC and linked.')), note(t('这一步没有扣款。', 'No debit occurred in this step.')));
    } else {
      const processing = s.phase === 'processing' || s.busy;
      const descriptions={no_record:[t('服务器未找到这笔请求','No server record for this request'),t('这是本次查询结果，不代表短信已发送或已失败。原编号继续保留；不会自动重发、清除或付款。','This is the result of this query, not proof of SMS delivery or failure. The original reference is retained. No automatic resend, clearing or payment.')],
        read_only:[t('只读核对原请求','Read the original request only'),t('新短信与付款入口已关闭。可以刷新原状态，或交由店员处理；不会重建付款凭据。','New SMS and payment entry are closed. Read the original status or ask staff to review it. Payment proof is not recreated.')],
        charged_review:[t('已扣款，预约需要店员核对','Debited; booking needs staff review'),t('服务器记录款项已扣，但当前预约未确认或状态已改变。请勿再次付款；本页不自动退款，请交由店员核对。','The server records a debit, but the current booking is unconfirmed or changed. Do not pay again. This page does not refund automatically; staff must review it.')],
        storage_review:[t('原核对记录需员工处理','Original recovery record needs staff review'),t('本地记录格式异常，原记录已保留。本页不会发送短信或再次扣款，请员工检查后台交易。','The local record format is invalid and is retained. This page will not send SMS or debit again. Staff must check the server transaction.')],
        expired:[t('原TAC已过期','The original TAC expired'),t('原请求继续保留。不会延长有效期、重发短信或付款，请联系店员。','The original request is retained. No extension, SMS resend or payment occurs. Contact staff.')],
        verified_no_proof:[t('TAC已验证，尚未确认付款','TAC verified; payment not confirmed'),t('恢复查询不会重建一次性付款凭据，也不会扣款。请联系店员核对后续步骤。','Recovery does not recreate the one-use payment proof or debit funds. Contact staff for the next step.')],
        failed:[t('服务器记录付款失败','The server records a failed payment'),t('本页不会重试扣款。请联系店员核对原交易与预约后再处理。','This page will not retry the debit. Ask staff to review the original transaction and booking.')],
        send_unknown:[t('短信发送结果待核对','SMS sending result needs review'),t('请只查询原请求；不会自动重新发送短信或付款。','Query the original request only. No automatic SMS resend or payment.')],
        recovery_unavailable:[t('原请求状态暂时不可用','Original request status unavailable'),t('查询失败不代表发送或付款失败。保留原编号，请勿重复操作。','A query failure does not prove sending or payment failed. Keep the original reference and do not repeat the action.')]};
      const description=descriptions[s.phase]||[t('原请求／付款结果待核对','Original request / payment needs review'),t('请勿再次付款。可刷新本次结果；若仍未确认，请向店员提供下方编号。','Do not pay again. Refresh this result, or give staff the reference below if it remains unconfirmed.')];
      card.append(element('strong',processing?t('正在核对，请稍候…','Checking, please wait…'):description[0]),note(description[1]),
        note(t('核对编号：', 'Reference: ') + (s.intent?.id || s.requestId || '—')),
        button(t('只刷新本次结果', 'Refresh this result only'), () => controller.read(), true));
    }
    if(s.startError)card.append(note(s.startError==='RATE_LIMITED'?t('服务器返回 RATE_LIMITED：请员工核对60秒冷却、每小时或每日测试额度；本页不会自动重试。','Server response RATE_LIMITED: ask staff to check the 60-second cooldown, hourly or daily test limits. This page will not retry automatically.'):t('原发送回复未完成核对；请保留原编号。','The original send response is unconfirmed. Retain the original reference.')));
    const error = element('p', s.error ? t(...(errors[s.error] || ['操作未完成。请刷新本次结果或联系店员，勿重复付款。', 'The request could not be confirmed. Refresh this result or contact staff; do not pay again.'])) : '', 'gg-tac-error');
    error.setAttribute('role', 'status'); error.setAttribute('aria-live', 'polite'); card.append(error); root.append(card);
    clock();
  }
  controller = createLiveController({call, context, userId, enabled, ownerAcceptance, store,readOnly,
    onChange: render, onSettled});
  clock(); const interval = setInterval(clock, 500);
  return {setLanguage(value) {lang = value === 'en' ? 'en' : 'zh'; render(controller.view);},
    setContext(value) {controller.setContext(value);}, signOut() {controller.signOut();},
    dispose() {disposed = true; clearInterval(interval); controller.dispose(); root.replaceChildren(); onBusyChange(false);}};
}
