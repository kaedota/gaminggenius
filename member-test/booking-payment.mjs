import config from './config.js';
export function createBookingPaymentApi(client){
 return async(action,details={})=>{
 const{data}=await client.auth.getSession();
 const r=await fetch(config.supabaseUrl+'/functions/v1/gg-shop',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,...(data.session?{Authorization:'Bearer '+data.session.access_token}:{})},body:JSON.stringify({action:'booking_'+action,...details})});
 const result=await r.json();if(!r.ok)throw Error(result.error||'PAYMENT_UNAVAILABLE');return result;
 };
}

