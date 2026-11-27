const ACTIONS=new Set(['live_tac_access','start_live_tac','verify_live_tac','pay_live_tac','read_live_tac_result','recover_live_tac_request']);
export function createLiveMemberCall(client,config,{fetchImpl=fetch}={}){
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.supabaseUrl||'')||!config.publishableKey)throw Error('CONFIG_MISSING');
  return async(action,payload={})=>{
    if(!ACTIONS.has(action))throw Error('INVALID_ACTION');
    const{data,error}=await client.auth.getSession();if(error||!data?.session?.access_token)throw Error('AUTH_REQUIRED');
    let response,result;try{response=await fetchImpl(config.supabaseUrl+'/functions/v1/gg-pospal',{method:'POST',cache:'no-store',redirect:'error',
      headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({...payload,action}),
      signal:AbortSignal.timeout(['start_live_tac','verify_live_tac','pay_live_tac'].includes(action)?120000:20000)});result=await response.json();}
    catch{throw Error('TAC_SERVICE_UNAVAILABLE');}
    if(!response.ok)throw Error(/^[A-Z_]{1,80}$/.test(result?.error||'')?result.error:'TAC_SERVICE_UNAVAILABLE');
    if(result?.live_candidate!==true||result.dry_run===true)throw Error('TAC_RESPONSE_INVALID');return result;
  };
}
export function acceptsOwnerAccess(result){return result?.live_candidate===true&&result.owner_only===true&&result.requires_mfa===true&&result.allowed===true;}
export function acceptsOwnerIdentity(result){return result?.live_candidate===true&&result.owner_only===true&&result.requires_mfa===true&&typeof result.allowed==='boolean';}
