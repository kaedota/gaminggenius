// Browser transport: GG login authorises only its own session. Membership
// authorisation is a fresh, server-verified, purpose-specific phone TAC.
export function createPassHttpBridge({client,config,expectedUserId,fetchImpl=fetch}){
 if(!client?.auth||!expectedUserId||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.supabaseUrl||'')||!config.publishableKey?.startsWith('sb_publishable_'))throw Error('PASS_BRIDGE_NOT_CONFIGURED');
 const actions=new Set(['gta_pass_catalog','gta_pass_account','gta_pass_wallet','start_gta_pass_tac','verify_gta_pass_tac','recover_gta_pass_tac','close_unused_gta_pass_tac','gta_pass_create_order','gta_pass_recover_order','gta_pass_redeem','gta_pass_recover_redemption','gta_pass_cancel_booking','gta_pass_availability','gta_pass_admin_list','gta_pass_staff_booking','gta_pass_staff_start','gta_pass_room_action']);
 async function session(){const r=await client.auth.getSession();if(r.error||!r.data?.session?.access_token)throw Error('AUTH_REQUIRED');if(r.data.session.user?.id!==expectedUserId)throw Error('AUTH_ACCOUNT_CHANGED');return r.data.session;}
 actions.add('gta_pass_staff_assign');actions.add('gta_pass_staff_assign_get');
 async function dispatch(action,payload={}){
  if(!actions.has(action)||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('INVALID_INPUT');const current=await session();
  let response,result;try{response=await fetchImpl(config.supabaseUrl+'/functions/v1/gg-passes',{method:'POST',cache:'no-store',redirect:'error',headers:{apikey:config.publishableKey,Authorization:'Bearer '+current.access_token,'Content-Type':'application/json'},body:JSON.stringify({...payload,action}),signal:AbortSignal.timeout(['start_gta_pass_tac','verify_gta_pass_tac'].includes(action)?120000:action==='gta_pass_create_order'?45000:20000)});result=await response.json();}catch{await session();throw Error('PASS_SERVICE_UNAVAILABLE');}
  await session();if(!response.ok)throw Error(/^[A-Z_]{2,80}$/.test(result?.error||'')?result.error:'PASS_SERVICE_UNAVAILABLE');if(result?.flow!=='gta_pass'||result.dry_run===true)throw Error('PASS_RESPONSE_INVALID');return result;
 }
 return{dispatch,tac:{start:input=>dispatch('start_gta_pass_tac',input),verify:input=>dispatch('verify_gta_pass_tac',input),recover:input=>dispatch('recover_gta_pass_tac',input),closeUnused:input=>dispatch('close_unused_gta_pass_tac',input)}};
}
