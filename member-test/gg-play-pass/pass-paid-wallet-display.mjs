const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES=new Set(['reserved','used','cancelled_returned','cancelled_consumed','no_show']);
const invalid=()=>{throw Error('PASS_RESPONSE_INVALID');};
export function safePassSource(raw){
 const test=raw?.source==='owner_test_noncash'||raw?.is_test===true;
 if(test){if(raw?.source!=='owner_test_noncash'||raw?.is_test!==true||raw?.label!=='OWNER TEST · NO PAYMENT')invalid();return{source:'owner_test_noncash',is_test:true,label:'OWNER TEST · NO PAYMENT'};}
 if(raw?.source!==undefined&&raw.source!=='paid_fpx'||raw?.is_test!==undefined&&raw.is_test!==false||raw?.label!==undefined&&raw.label!=='GTA Pass')invalid();
 return{source:'paid_fpx',is_test:false,label:'GTA Pass'};
}
export function passValidity(pass,now=Date.now()){
 const start=Date.parse(pass?.valid_from),end=Date.parse(pass?.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end-start!==90*86400000||!Number.isFinite(now))invalid();
 const expired=end<=now||pass.expired===true||pass.remaining_days===0;
 return{expired,remainingDays:expired?0:Math.min(90,Math.ceil((end-now)/86400000)),expires_at:pass.expires_at};
}
export function safeDisplayPass(raw,{staff=false,now=Date.now()}={}){
 const provenance=safePassSource(raw);
 if(!UUID.test(raw?.id)||!(provenance.is_test?raw.order_id===null:UUID.test(raw?.order_id))||raw.total_uses!==30||!Array.isArray(raw.redemptions)||raw.redemptions.length>1000||typeof raw.expired!=='boolean'||!Number.isSafeInteger(raw.remaining_days)||raw.remaining_days<0||raw.remaining_days>90)invalid();
 const c=raw.counts;if(!c||['available','reserved','used','expired'].some(k=>!Number.isSafeInteger(c[k])||c[k]<0)||c.available+c.reserved+c.used+c.expired!==30||raw.remaining_uses!==c.available)invalid();
 const validity=passValidity(raw,now),seen=new Set();
 const redemptions=raw.redemptions.map(r=>{
  if(!UUID.test(r?.id)||!UUID.test(r.request_id)||r.pass_id!==raw.id||!Number.isInteger(r.ordinal)||r.ordinal<1||r.ordinal>30||!STATES.has(r.state)||!/^\d{4}-\d{2}-\d{2}$/.test(r.business_date)||!Number.isInteger(r.start_minute)||r.start_minute<0||r.start_minute>=1440||r.minutes!==120||!Number.isInteger(r.people)||r.people<1||r.people>4||r.cash_due_cents!==0||!UUID.test(r.booking_id)||seen.has(r.id))invalid();
  seen.add(r.id);return{...r};
 });
 const p={...provenance,id:raw.id,order_id:raw.order_id,total_uses:30,remaining_uses:c.available,counts:{available:c.available,reserved:c.reserved,used:c.used,expired:c.expired},valid_from:raw.valid_from,expires_at:raw.expires_at,expired:validity.expired,remaining_days:validity.remainingDays,redemptions};
 if(staff){if(['member_name','member_number','phone'].some(k=>raw[k]!==null&&typeof raw[k]!=='string'))invalid();Object.assign(p,{member_name:raw.member_name,member_number:raw.member_number,phone:raw.phone});}
 return p;
}
export function safeAccountPasses(raw,options={}){if(raw===undefined)return null;if(!Array.isArray(raw)||raw.length>1000)invalid();const ids=new Set();return raw.map(p=>{const value=safeDisplayPass(p,options);if(ids.has(value.id))invalid();ids.add(value.id);return value;});}
export const safeStaffPasses=(raw,now=Date.now())=>safeAccountPasses(raw,{staff:true,now});
export function passStateLabel(state,language='zh'){
 const labels={reserved:['预约中·已占券','BOOKED · VOUCHER RESERVED'],used:['已使用','USED'],cancelled_returned:['已取消·原券退回','CANCELLED · VOUCHER RETURNED'],cancelled_consumed:['已取消·扣券','CANCELLED · VOUCHER USED'],no_show:['未到场·扣券','NO-SHOW · VOUCHER USED']};
 return labels[state]?.[language==='en'?1:0]||'—';
}
