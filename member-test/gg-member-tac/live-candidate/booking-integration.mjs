import {mountLiveTacCheckout} from './tac-checkout.mjs?v=owner-live-v2';
export {hasSubmittedRecovery,hasAnyRecovery,storedRecoveryContext} from './live-controller.mjs?v=owner-live-v2';

export function bookingTacContext(state, method = 'balance') {
  const stations = {PS5: 'PS5', Switch: 'Switch', Simulator28: 'SIM01', Simulator38: 'SIM02'};
  if (!stations[state.type] || !['balance', 'points'].includes(method)) throw Error('INVALID_CONTEXT');
  return {purpose: method === 'points' ? 'booking_points' : 'booking_balance', booking: {
    station: stations[state.type], date: state.date, startMinute: state.start, minutes: state.minutes, people: state.people}};
}

export function mountBookingTac(root, options) {
  // No flag from a query parameter, localStorage, or window can enable this.
  // Server Owner+MFA, phone allowlist and release gates are still mandatory.
  if (!document.querySelector('[data-gg-tac-style]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = new URL('./live-checkout.css?v=owner-live-v2', import.meta.url).href; link.dataset.ggTacStyle = ''; document.head.append(link);
  }
  return mountLiveTacCheckout(root, options);
}
