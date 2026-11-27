const ACTIONS = new Set(['start_tac', 'verify_tac', 'read_tac_result', 'recover_tac_request']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        body:JSON.stringify({...payload, action}), signal:AbortSignal.timeout(['start_tac','verify_tac'].includes(action)?120000:20000)});
      result = await response.json();
    } catch {throw Error('TAC_SERVICE_UNAVAILABLE');}
    if (!response.ok) throw Error(/^[A-Z_]+$/.test(result?.error || '') ? result.error : 'TAC_SERVICE_UNAVAILABLE');
    if (result?.dry_run !== true) throw Error('TAC_RESPONSE_INVALID');
    return result;
  };
}

// Metadata only. Unexpected phone/member/code fields are deliberately discarded.
export function safeRecoveryMetadata(result, requestId){
  if(!UUID.test(requestId||'')||result?.dry_run!==true||result.request_id!==requestId||result.can_send!==false||result.charged!==false||result.booking_confirmed!==false||typeof result.found!=='boolean')throw Error('TAC_RESPONSE_INVALID');
  const safe={dry_run:true,request_id:requestId,found:result.found,can_send:false,charged:false,booking_confirmed:false};
  if(!result.found)return safe;
  if(!UUID.test(result.challenge_id||'')||result.purpose!=='link'||!Number.isInteger(result.expires_in)||result.expires_in<0||result.expires_in>300||!Number.isInteger(result.retry_after)||result.retry_after<0||result.retry_after>60||typeof result.can_verify!=='boolean')throw Error('TAC_RESPONSE_INVALID');
  return {...safe,challenge_id:result.challenge_id,purpose:'link',state:String(result.state),delivery_state:String(result.delivery_state),expires_in:result.expires_in,retry_after:result.retry_after,can_verify:result.can_verify};
}
export function recoveredStartShape(meta){
  if(!meta.found||!meta.can_verify||meta.expires_in<=0)throw Error('TAC_RECOVERY_REQUIRED');
  return{challenge_id:meta.challenge_id,expires_in:meta.expires_in,retry_after:Math.max(1,meta.retry_after),message:'TAC_REQUEST_ACCEPTED',dry_run:true};
}
export function clearExpiredOwnerPending(meta,{loadPending,clearPending}){
  if(meta?.dry_run!==true||meta.purpose!=='link'||meta.found!==true||meta.can_send!==false||meta.charged!==false||meta.booking_confirmed!==false||
    meta.state!=='expired'||meta.expires_in!==0||meta.can_verify!==false||!UUID.test(meta.request_id||'')||loadPending()!==meta.request_id)return false;
  clearPending(); // Caller removes only the current Owner's matched dryrun reference.
  return true;
}
export function createSafeOwnerPilotCall(raw,{loadPending,savePending,onRecovery=()=>{}}){
  async function recover(requestId){return safeRecoveryMetadata(await raw('recover_tac_request',{request_id:requestId}),requestId);}
  return async(action,payload)=>{
    if(action!=='start_tac')return raw(action,payload);
    const pending=loadPending();
    if(pending){try{onRecovery(await recover(pending));}catch{onRecovery({request_id:pending,recoveryUnavailable:true});}throw Error('TAC_RECOVERY_REQUIRED');}
    if(!UUID.test(payload?.request_id||''))throw Error('INVALID_INPUT');
    savePending(payload.request_id); // Required before the one explicit SMS request.
    try{return await raw(action,payload);}
    catch(startError){
      // This is one read-only metadata query, NEVER another start/SMS request.
      try{const meta=await recover(payload.request_id);if(meta.can_verify&&meta.expires_in>0)return recoveredStartShape(meta);onRecovery(meta);}
      catch(recoveryError){onRecovery({request_id:payload.request_id,recoveryUnavailable:true});}
      throw Error('TAC_RECOVERY_REQUIRED');
    }
  };
}
