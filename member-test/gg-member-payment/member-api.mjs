const ACTIONS=new Set(['member_tac_access','member_tac_account','start_member_tac','verify_member_tac','pay_member_tac','recover_member_tac','read_member_tac_result','close_unpaid_member_tac']);
export function createMemberCall(client,config,{fetchImpl=fetch,expectedUserId}={}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.supabaseUrl||'')||!config.publishableKey)throw Error('CONFIG_MISSING');
 return async(action,payload={})=>{
  if(!ACTIONS.has(action))throw Error('INVALID_ACTION');const{data,error}=await client.auth.getSession();if(error||!data?.session?.access_token)throw Error('AUTH_REQUIRED');if(expectedUserId&&data.session.user?.id!==expectedUserId)throw Error('AUTH_ACCOUNT_CHANGED');
  let response,result;try{response=await fetchImpl(config.supabaseUrl+'/functions/v1/gg-pospal',{method:'POST',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({...payload,action}),signal:AbortSignal.timeout(['start_member_tac','verify_member_tac','pay_member_tac'].includes(action)?120000:20000)});result=await response.json();}catch{throw Error('TAC_SERVICE_UNAVAILABLE');}
  if(!response.ok)throw Error(/^[A-Z_]{1,80}$/.test(result?.error||'')?result.error:'TAC_SERVICE_UNAVAILABLE');
  if(result?.flow!=='payment_only'||result.live_candidate===true||result.dry_run===true)throw Error('TAC_RESPONSE_INVALID');return result;
 };
}
export function permitsPurpose(access,purpose){return access?.flow==='payment_only'&&access.allowed===true&&(purpose==='lookup'?access.can_lookup===true:access.can_pay===true&&access.allocation_policy==='payment_success_only');}
