const ACTIONS = new Set(['start_tac', 'verify_tac', 'read_tac_result', 'recover_tac_request']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const START_ERRORS=new Set(['AUTH_REQUIRED','TAC_NOT_OPEN','TAC_LIVE_DISABLED','TAC_TEST_PHONE_NOT_ALLOWED','INVALID_INPUT','INVALID_PHONE','SMS_PAYMENT_PURPOSE_NOT_APPROVED','RATE_LIMITED','REQUEST_REUSED_WITH_DIFFERENT_DETAILS','TAC_SERVICE_UNAVAILABLE','TAC_RESPONSE_INVALID']);
export function safeStartError(value){const code=typeof value==='string'?value:value?.message;return START_ERRORS.has(code)?code:null;}
export function authenticatedIdentityText(user,language='zh'){
  const email=user?.email;if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+$/.test(email))return '';
  return(language==='en'?'GG signed-in account: ':'GG 登录账号：')+email;
}
export function recoveryNotice(meta,language='zh'){
  const en=language==='en';let title='',message='';
  if(meta.found===false){title=en?'No server record for this request':'服务器未找到这笔请求';
    message=en?'No record was found for this reference in this query. This does not prove that sending succeeded or failed. No automatic resend or saved-request clearing will occur.':'本次查询未找到这个编号的服务器记录；这不代表短信已发送或已失败。不会自动重发，也不会清除已保存的发送请求。';}
  const code=safeStartError(meta.start_error_code);
  const denial=code?(code==='RATE_LIMITED'?(en?'The original send returned a frequency or test-quota limit (RATE_LIMITED). No automatic retry.':'原发送返回频率或测试额度限制（RATE_LIMITED）；不会自动重试。'):
    ['TAC_SERVICE_UNAVAILABLE','TAC_RESPONSE_INVALID'].includes(code)?(en?'The original send result was unconfirmed ('+code+'). Review the original request before taking another action.':'原发送结果未确认（'+code+'）；请先核对原请求。'):
    (en?'Original send response: '+code+'. No automatic retry.':'原发送返回：'+code+'；不会自动重试。')):'';
  return{title,message,denial};
}

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
  const safe={dry_run:true,request_id:requestId,found:result.found,can_send:false,charged:false,booking_confirmed:false,checked_at:new Date().toISOString()};
  if(!result.found)return safe;
  if(!UUID.test(result.challenge_id||'')||result.purpose!=='link'||!Number.isInteger(result.expires_in)||result.expires_in<0||result.expires_in>300||!Number.isInteger(result.retry_after)||result.retry_after<0||result.retry_after>60||typeof result.can_verify!=='boolean')throw Error('TAC_RESPONSE_INVALID');
  return {...safe,challenge_id:result.challenge_id,purpose:'link',state:String(result.state),delivery_state:String(result.delivery_state),expires_in:result.expires_in,retry_after:result.retry_after,can_verify:result.can_verify};
}
export function createReadonlyRecoveryQuery(raw){return async requestId=>{
  if(!UUID.test(requestId||''))throw Error('INVALID_INPUT');
  return safeRecoveryMetadata(await raw('recover_tac_request',{request_id:requestId}),requestId);
};}
export function recoveredStartShape(meta){
  if(!meta.found||!meta.can_verify||meta.expires_in<=0)throw Error('TAC_RECOVERY_REQUIRED');
  return{challenge_id:meta.challenge_id,expires_in:meta.expires_in,retry_after:Math.max(1,meta.retry_after),message:'TAC_REQUEST_ACCEPTED',dry_run:true};
}
export function clearExpiredOwnerPending(meta,{loadPending,clearPending,inFlight=false}){
  if(inFlight!==false||meta?.dry_run!==true||meta.purpose!=='link'||meta.found!==true||meta.can_send!==false||meta.charged!==false||meta.booking_confirmed!==false||
    meta.state!=='expired'||meta.expires_in!==0||meta.can_verify!==false||!UUID.test(meta.request_id||'')||loadPending()!==meta.request_id)return false;
  clearPending(); // Caller removes only the current Owner's matched dryrun reference.
  return true;
}
export function archiveNoRecordOwnerPending(meta,{ownerId,loadPendingRecord,saveHistory,clearPending,inFlight,now=()=>Date.now()}){
  if(inFlight!==false||!UUID.test(ownerId||'')||meta?.dry_run!==true||meta.found!==false||meta.recoveryUnavailable===true||
    meta.can_send!==false||meta.charged!==false||meta.booking_confirmed!==false||meta.live_candidate===true||
    (meta.purpose!==undefined&&meta.purpose!=='link')||!UUID.test(meta.request_id||'')||!Number.isFinite(Date.parse(meta.checked_at||'')))return false;
  const pending=loadPendingRecord();
  if(pending?.request_id!==meta.request_id||pending.ownerId!==ownerId||pending.purpose!=='link'||pending.dry_run!==true||pending.kind!=='owner_link_tac_dry_run')return false;
  const entry={request_id:pending.request_id,ownerId,purpose:'link',dry_run:true,kind:'owner_link_tac_dry_run',
    status:'no_record_at_check',checked_at:meta.checked_at,archived_at:new Date(now()).toISOString()};
  const code=safeStartError(meta.start_error_code||pending.start_error_code);if(code)entry.start_error_code=code;
  saveHistory(entry); // Persist the unresolved evidence BEFORE removing its active reference.
  clearPending();
  return true;
}
export function createSafeOwnerPilotCall(raw,{loadPending,savePending,saveStartFailure=()=>{},onRecovery=()=>{}}){
  async function recover(requestId){return safeRecoveryMetadata(await raw('recover_tac_request',{request_id:requestId}),requestId);}
  return async(action,payload)=>{
    if(action!=='start_tac')return raw(action,payload);
    const pending=loadPending();
    if(pending){try{onRecovery(await recover(pending));}catch{onRecovery({request_id:pending,recoveryUnavailable:true});}throw Error('TAC_RECOVERY_REQUIRED');}
    if(!UUID.test(payload?.request_id||''))throw Error('INVALID_INPUT');
    savePending(payload.request_id); // Required before the one explicit SMS request.
    try{return await raw(action,payload);}
    catch(startError){
      const code=safeStartError(startError);if(code){try{saveStartFailure(payload.request_id,code);}catch{}}
      const failure=code?{start_error_code:code}:{};
      // This is one read-only metadata query, NEVER another start/SMS request.
      try{const meta=await recover(payload.request_id);if(meta.can_verify&&meta.expires_in>0)return recoveredStartShape(meta);onRecovery({...meta,...failure});}
      catch(recoveryError){onRecovery({request_id:payload.request_id,recoveryUnavailable:true,...failure});}
      throw Error('TAC_RECOVERY_REQUIRED');
    }
  };
}
