import{checkoutPolicyEnabled}from'./booking-payment-model.mjs?v=fpx-hold5m-v1';
import {createBookingPaymentApi} from './booking-payment.mjs?v=paid-only-v1';
// Integration boundary for the EXISTING GG Supabase client. No new client,
// token persistence, account, role, password or OAuth setup is introduced.
export function createBookingApi(client){
 const payment=createBookingPaymentApi(client);
 const call=async(name,args={})=>{const{data,error}=await client.rpc(name,args);if(error)throw error;return data;};
 const member=async()=>{const{data,error}=await client.auth.getUser();if(error)throw error;if(!data?.user)throw Error('AUTH_REQUIRED');await call('gg_session');return data.user;};
 return{
  catalog:async()=>{const c=await call('gg_booking_catalog');const p=await payment('catalog').catch(()=>({enabled:false}));const supported=checkoutPolicyEnabled(p);return {...c,enabled:c.enabled&&p.enabled&&supported,fpx_enabled:p.enabled&&supported,payment_method:'fpx',allocation_policy:p.allocation_policy,pending_reserves_slot:p.pending_reserves_slot,checkout_hold_seconds:p.checkout_hold_seconds};},
  payment,
  availability:date=>call('gg_booking_availability',{p_date:date}),
  async hold({station,date,startMinute,minutes,people,requestId,phone}){
   await member();
   if(!/^(PS5|Switch)-[123]$/.test(station)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(startMinute)||!Number.isInteger(people)||people<1||people>4||![60,120,180].includes(minutes)||!/^[0-9a-f-]{36}$/i.test(requestId))throw Error('INVALID_SELECTION');
   const compact=phone?.trim().replace(/[ ().-]/g,'') ?? '';
   const normalized=/^0[1-9][0-9]{7,9}$/.test(compact)?'+60'+compact.slice(1):compact;
   if(!/^\+[1-9][0-9]{7,14}$/.test(normalized))throw Error('INVALID_CONTACT_PHONE');
   // Never accepts a price, identity, payment status or expiry from the browser.
   return call('gg_booking_reserve_with_phone',{p_station:station,p_date:date,p_start:startMinute,p_minutes:minutes,p_people:people,p_request:requestId,p_phone:normalized});
  },
  async mine(){await member();return call('gg_booking_mine');},
  async cancelUnpaidHold(id){await member();return call('gg_booking_cancel_reservation',{p_id:id});}
 };
}

export const bookingMessages={INVALID_CONTACT_PHONE:'请输入有效的联系电话，例如 012-345 6789 或 +60 12 345 6789。',STATION_SESSION_OVERRUN:'这台机位仍在使用中，请店员确认结束后再预约。',AUTH_REQUIRED:'请先登录 GG 会员。',BOOKING_NOT_OPEN:'预约服务尚未开放。',SLOT_TAKEN:'这个时段刚被预约，请重新选择。',STATION_UNAVAILABLE:'该机位暂停开放。',INVALID_DATE:'这个时间已过或超出可预约范围。',OUTSIDE_OPENING_HOURS:'该时段超出营业时间。',TOO_MANY_ACTIVE_BOOKINGS:'最多同时保留3笔未结束预约，请先处理现有预约。',BOOKING_NOT_CANCELLABLE:'开场后或已收款的预约，请联系店员处理。',REQUEST_REUSED_WITH_DIFFERENT_DETAILS:'预约内容已变化，请重新确认。'};


