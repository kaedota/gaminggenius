import {ACTIONS} from './model.mjs';

// The caller supplies the existing authenticated GG memberCall(client).
// This module contains no SMS credentials, demo codes, direct provider calls,
// account-creation route, old wallet_pay route, or real payment capability.
export function createTacAdapter(call) {
  if (typeof call !== 'function') throw Error('AUTH_REQUIRED');
  return async (action, payload) => {
    if (!ACTIONS.has(action)) throw Error('INVALID_ACTION');
    const response = await call(action, payload);
    if (!response || response.dry_run !== true) throw Error('TAC_RESPONSE_INVALID');
    return response;
  };
}

export function observeSignOut(client, flow) {
  const subscription = client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') flow.signOut();
  });
  return () => subscription?.data?.subscription?.unsubscribe();
}
