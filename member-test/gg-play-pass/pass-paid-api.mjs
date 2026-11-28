import{FLOW,safeFlow}from'./pass-paid-model.mjs?v=paid-only-v1';
export const PASS_ACTIONS=Object.freeze({catalog:'gta_pass_catalog',account:'gta_pass_account',wallet:'gta_pass_wallet',createOrder:'gta_pass_create_order',recoverOrder:'gta_pass_recover_order',cancelOrder:'gta_pass_cancel_order',closeRequest:'gta_pass_close_request',redeem:'gta_pass_redeem',recoverRedemption:'gta_pass_recover_redemption',cancelBooking:'gta_pass_cancel_booking',availability:'gta_pass_availability'});
const NO_DATA=new Set(['catalog','account']);
// Deliberately no production URL or fetch here: the server/TAC bridge must be
// explicitly supplied after its exact HTTP contract and gates are accepted.
export function createPassApi({dispatch,tac,expectedUserId,getUserId}){
 if(typeof dispatch!=='function'||typeof getUserId!=='function'||!expectedUserId)throw Error('PASS_BRIDGE_NOT_CONNECTED');
 async function identity(){if(await getUserId()!==expectedUserId)throw Error('AUTH_ACCOUNT_CHANGED');}
 const call=async(method,input={})=>{await identity();if(!Object.hasOwn(PASS_ACTIONS,method))throw Error('INVALID_ACTION');if(!input||typeof input!=='object'||Array.isArray(input)||NO_DATA.has(method)&&Object.keys(input).length)throw Error('INVALID_INPUT');const result=await dispatch(PASS_ACTIONS[method],input);await identity();safeFlow(result);return result;};
 const tacCall=async(method,input)=>{await identity();if(!['start','verify','recover','closeUnused'].includes(method)||typeof tac?.[method]!=='function')throw Error('GTA_PASS_TAC_NOT_CONNECTED');const result=await tac[method](input);await identity();if(result?.flow!==FLOW||result.purpose&& !['pass_lookup','pass_purchase','pass_redeem'].includes(result.purpose))throw Error('PASS_RESPONSE_INVALID');return result;};
 return{call,startTac:input=>tacCall('start',input),verifyTac:input=>tacCall('verify',input),recoverTac:input=>tacCall('recover',input),closeUnusedTac:input=>tacCall('closeUnused',input)};
}
export function closedDeploymentBridge(){return{dispatch:async()=>{throw Error('GTA_PASS_NOT_CONNECTED');},tac:{start:async()=>{throw Error('GTA_PASS_TAC_NOT_CONNECTED');},verify:async()=>{throw Error('GTA_PASS_TAC_NOT_CONNECTED');},recover:async()=>{throw Error('GTA_PASS_TAC_NOT_CONNECTED');},closeUnused:async()=>{throw Error('GTA_PASS_TAC_NOT_CONNECTED');}}};}
