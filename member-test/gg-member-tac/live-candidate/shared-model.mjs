export const ACTIONS = new Set(['start_tac', 'verify_tac', 'read_tac_result']);
const PURPOSES = new Set(['link', 'booking_balance', 'booking_points']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOOKING_FIELDS = ['station', 'date', 'startMinute', 'minutes', 'people'];

export function normalizePhone(value) {
  let phone = String(value ?? '').replace(/[ ().-]/g, '');
  if (/^0[1-9][0-9]{7,9}$/.test(phone)) phone = '+60' + phone.slice(1);
  else if (/^60[1-9][0-9]{7,9}$/.test(phone)) phone = '+' + phone;
  if (!/^\+601[0-9]{8,9}$/.test(phone)) throw Error('INVALID_PHONE');
  return phone;
}

export function contextKey(context) {
  if (!PURPOSES.has(context?.purpose)) throw Error('INVALID_CONTEXT');
  const booking = context.purpose === 'link' ? null : Object.fromEntries(BOOKING_FIELDS.map(key => [key, context.booking?.[key]]));
  if (booking && (typeof booking.station !== 'string' || !booking.station || !/^\d{4}-\d{2}-\d{2}$/.test(booking.date) ||
      !Number.isInteger(booking.startMinute) || !Number.isInteger(booking.minutes) || booking.minutes <= 0 ||
      !Number.isInteger(booking.people) || booking.people < 1)) throw Error('INVALID_CONTEXT');
  return JSON.stringify({purpose: context.purpose, booking});
}

export function initialState(context, epoch = 0) {
  const key = contextKey(context);
  return {phase: 'phone', context: JSON.parse(key), key, epoch, phone: '', requestId: null,
    challenge: null, review: null, receiptId: null, result: null, busy: false, operation: null, error: null};
}

export function secondsLeft(state, now) { return state.challenge ? Math.max(0, Math.ceil((state.challenge.expiresAt - now) / 1000)) : 0; }
export function resendLeft(state, now) { return state.challenge ? Math.max(0, Math.ceil((state.challenge.retryAt - now) / 1000)) : 0; }
export function isUuid(value) { return typeof value === 'string' && UUID.test(value); }

function safeText(value, max = 100) {
  if (typeof value !== 'string' || !value || value.length > max) throw Error('TAC_RESPONSE_INVALID');
  return value;
}
function amount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw Error('TAC_RESPONSE_INVALID');
  return number;
}
export function safeReview(review, context) {
  if (!review?.member) throw Error('TAC_RESPONSE_INVALID');
  const member = {number: safeText(review.member.number), name: safeText(review.member.name, 128),
    balance: amount(review.member.balance), points: amount(review.member.points)};
  let quote = null;
  if (context.purpose !== 'link') {
    const source = review.quote;
    if (!source || source.purpose !== context.purpose || BOOKING_FIELDS.some(key => source[key] !== context.booking[key]) ||
        !Number.isSafeInteger(source.cents) || source.cents <= 0 || !Number.isSafeInteger(source.points) || source.points < 0) throw Error('TAC_CONTEXT_CHANGED');
    quote = {...Object.fromEntries(BOOKING_FIELDS.map(key => [key, source[key]])), cents: source.cents, points: source.points, purpose: source.purpose};
  } else if (review.quote !== null) throw Error('TAC_RESPONSE_INVALID');
  return {member, quote};
}

export function reduce(state, event, now = Date.now()) {
  if (event.type === 'SIGNED_OUT') return {...initialState(state.context, state.epoch + 1), phase: 'auth'};
  if (event.type === 'DISPOSE') return {...initialState(state.context, state.epoch + 1), phase: 'disposed'};
  if (['auth', 'disposed'].includes(state.phase)) return state;
  if (event.type === 'CONTEXT') {
    if (contextKey(event.context) === state.key) return state;
    return {...initialState(event.context, state.epoch + 1), phone: state.phone};
  }
  if (event.type === 'RESET') return {...initialState(state.context, state.epoch + 1), phone: event.phone ?? state.phone};
  if (event.type === 'BEGIN_START') {
    if (state.busy || !isUuid(event.requestId)) return state;
    if (state.challenge && resendLeft(state, now) > 0 && event.resend) return state;
    let phone;
    try { phone = normalizePhone(event.phone); } catch { return {...state, error: 'INVALID_PHONE'}; }
    return {...initialState(state.context, state.epoch + 1), phone, requestId: event.requestId, busy: true, operation: 'start'};
  }
  if (event.epoch !== undefined && event.epoch !== state.epoch) return state;
  if (event.type === 'STARTED' && state.busy && state.operation === 'start') {
    const response = event.response;
    if (!response || response.dry_run !== true || !isUuid(response.challenge_id) || !Number.isInteger(response.expires_in) ||
        response.expires_in < 1 || response.expires_in > 300 || !Number.isInteger(response.retry_after) || response.retry_after < 1 || response.retry_after > 300) {
      return {...state, busy: false, operation: null, error: 'TAC_RESPONSE_INVALID'};
    }
    return {...state, phase: 'code', busy: false, operation: null, error: null,
      challenge: {id: response.challenge_id, expiresAt: now + response.expires_in * 1000, retryAt: now + response.retry_after * 1000}};
  }
  if (event.type === 'BEGIN_VERIFY') {
    if (state.busy || state.phase !== 'code') return state;
    if (!secondsLeft(state, now)) return {...state, error: 'TAC_EXPIRED'};
    if (!/^\d{6}$/.test(event.code)) return {...state, error: 'TAC_INVALID_CODE'};
    return {...state, busy: true, operation: 'verify', error: null};
  }
  if (event.type === 'VERIFIED' && state.busy && state.operation === 'verify') {
    if (!secondsLeft(state, now)) return {...state, busy: false, operation: null, error: 'TAC_EXPIRED'};
    try {
      if (event.response?.verified !== true || event.response?.dry_run !== true || !isUuid(event.response.receipt_id)) throw Error('TAC_RESPONSE_INVALID');
      return {...state, phase: 'review', busy: false, operation: null, error: null,
        review: safeReview(event.response.review, state.context), receiptId: event.response.receipt_id};
    } catch (error) { return {...state, busy: false, operation: null, review: null, receiptId: null, error: error.message}; }
  }
  if (event.type === 'BEGIN_CONFIRM') {
    if (state.busy || state.phase !== 'review' || !state.review || !state.receiptId) return state;
    return {...state, busy: true, operation: 'confirm', error: null};
  }
  if (event.type === 'COMPLETED' && state.busy && state.operation === 'confirm') {
    try {
      const response = event.response;
      if (response?.state !== 'verified_dry_run' || response.dry_run !== true || response.charged !== false ||
          response.booking_confirmed !== false || response.receipt_id !== state.receiptId ||
          JSON.stringify(safeReview(response.review, state.context)) !== JSON.stringify(state.review)) throw Error('TAC_RESPONSE_INVALID');
      return {...state, phase: 'done', busy: false, operation: null, error: null,
        result: {state: response.state, charged: false, bookingConfirmed: false}};
    } catch (error) { return {...state, busy: false, operation: null, error: error.message}; }
  }
  if (event.type === 'FAILED') {
    if (event.code === 'AUTH_REQUIRED') return {...initialState(state.context, state.epoch + 1), phase: 'auth'};
    return {...state, busy: false, operation: null, error: event.code || 'TAC_UNAVAILABLE'};
  }
  if (event.type === 'TICK' && state.phase === 'code' && !state.busy && !secondsLeft(state, now) && state.error !== 'TAC_EXPIRED') return {...state, error: 'TAC_EXPIRED'};
  return state;
}
