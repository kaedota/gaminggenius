// Integration boundary for the EXISTING GG Supabase client. No new client,
// token persistence, account, role, password or OAuth setup is introduced.
export function createBookingApi(client){
 const call=async(name,args={})=>{const{data,error}=await client.rpc(name,args);if(error)throw error;return data;};
 const member=async()=>{const{data,error}=await client.auth.getUser();if(error)throw error;if(!data?.user)throw Error('AUTH_REQUIRED');await call('gg_session');return data.user;};
 return{
  catalog:()=>call('gg_booking_catalog'),
  availability:date=>call('gg_booking_availability',{p_date:date}),
  async hold({station,date,startMinute,minutes,people,requestId}){
   await member();
   if(!/^(PS5|Switch)-[123]$/.test(station)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(startMinute)||!Number.isInteger(people)||people<1||people>4||![60,120,180].includes(minutes)||!/^[0-9a-f-]{36}$/i.test(requestId))throw Error('INVALID_SELECTION');
   // Never accepts a price, identity, payment status or expiry from the browser.
   return call('gg_booking_reserve',{p_station:station,p_date:date,p_start:startMinute,p_minutes:minutes,p_people:people,p_request:requestId});
  },
  async mine(){await member();return call('gg_booking_mine');},
  async cancelUnpaidHold(id){await member();return call('gg_booking_cancel_reservation',{p_id:id});}
 };
}

export const bookingMessages={AUTH_REQUIRED:'请先登录 GG 会员。',BOOKING_NOT_OPEN:'预约服务尚未开放。',SLOT_TAKEN:'这个时段刚被预约，请重新选择。',STATION_UNAVAILABLE:'该机位暂停开放。',INVALID_DATE:'这个时间已过或超出可预约范围。',OUTSIDE_OPENING_HOURS:'该时段超出营业时间。',TOO_MANY_ACTIVE_BOOKINGS:'最多同时保留3笔未结束预约，请先处理现有预约。',BOOKING_NOT_CANCELLABLE:'开场后或已收款的预约，请联系店员处理。',REQUEST_REUSED_WITH_DIFFERENT_DETAILS:'预约内容已变化，请重新确认。'};
