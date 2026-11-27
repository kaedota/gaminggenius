const ACTIONS = new Set(['start_tac', 'verify_tac', 'read_tac_result']);

export function createOwnerPilotCall(client, config, {fetchImpl = fetch} = {}) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.supabaseUrl || '') || !config.publishableKey) throw Error('CONFIG_MISSING');
  const endpoint = config.supabaseUrl + '/functions/v1/gg-tac-pilot';
  return async (action, payload) => {
    if (!ACTIONS.has(action)) throw Error('INVALID_ACTION');
    const {data, error} = await client.auth.getSession();
    if (error || !data?.session?.access_token) throw Error('AUTH_REQUIRED');
    let response, result;
    try {
      response = await fetchImpl(endpoint, {method:'POST', redirect:'error', cache:'no-store',
        headers:{'Content-Type':'application/json', apikey:config.publishableKey, Authorization:'Bearer ' + data.session.access_token},
        body:JSON.stringify({...payload, action}), signal:AbortSignal.timeout(20000)});
      result = await response.json();
    } catch {throw Error('TAC_SERVICE_UNAVAILABLE');}
    if (!response.ok) throw Error(/^[A-Z_]+$/.test(result?.error || '') ? result.error : 'TAC_SERVICE_UNAVAILABLE');
    if (result?.dry_run !== true) throw Error('TAC_RESPONSE_INVALID');
    return result;
  };
}
