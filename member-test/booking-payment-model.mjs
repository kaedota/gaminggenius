const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const HOLD_POLICY='payment_checkout_hold_5m_v1';
const POLICIES=new Set([HOLD_POLICY,'payment_success_only','legacy_reserved']);
const STATES=new Set(['creating','due','uncertain','paid','paid_unallocated','cancelled']);
const HOLD_STATES=new Set(['held','checking_bank','confirmed','released']);
const invalid=()=>{throw Error('PAYMENT_RECORD_INVALID');};
export function paymentUrl(value){if(value===null||value===undefined)return null;let u;try{u=new URL(value);}catch{invalid();}if(u.protocol!=='https:'||u.hostname!=='www.billplz.com'||u.username||u.password||u.port||!/^\/bills\/[A-Za-z0-9_-]{1,64}$/.test(u.pathname)||u.search||u.hash||u.href!==value)invalid();return u.href;}
export function safeBookingOrder(o){
 if(!o||!UUID.test(o.id)||!STATES.has(o.state)||!POLICIES.has(o.allocation_policy)||!Number.isSafeInteger(o.total)||o.total<=0||typeof o.paid!=='boolean'||typeof o.booking_confirmed!=='boolean'||o.booking_id!==null&&!UUID.test(o.booking_id))invalid();
 if(!['PS5','Switch','Simulator28','Simulator38'].includes(o.pool)||!/^\d{4}-\d{2}-\d{2}$/.test(o.business_date)||!Number.isInteger(o.start_minute)||o.start_minute<0||o.start_minute>=1440||![60,120,180].includes(o.minutes)||!Number.isInteger(o.people)||o.people<1||o.people>4)invalid();
 if(o.booking_confirmed&&(!o.paid||!UUID.test(o.booking_id)||o.state!=='paid')||o.state==='paid'&&!o.paid||o.state==='paid_unallocated'&&(!o.paid||o.booking_confirmed||o.refund_state!=='review')||!['paid','paid_unallocated'].includes(o.state)&&o.paid)invalid();
 if(o.allocation_policy!=='legacy_reserved'&&o.booking_confirmed&&(o.booking_payment_status!=='paid'||!['confirmed','checked_in','completed'].includes(o.booking_status)))invalid();
 if(o.paid&&!o.booking_confirmed&&o.allocation_policy!=='legacy_reserved'&&(o.requires_staff_review!==true||o.refund_state!=='review'))invalid();
 if(o.allocation_policy===HOLD_POLICY){
  if(!UUID.test(o.checkout_booking_id)||!Number.isFinite(Date.parse(o.checkout_deadline))||o.expires_at!==o.checkout_deadline||!HOLD_STATES.has(o.hold_state))invalid();
  if(o.booking_confirmed&&(o.booking_id!==o.checkout_booking_id||o.hold_state!=='confirmed'))invalid();
  if(['held','checking_bank'].includes(o.hold_state)&&(o.paid||o.booking_confirmed||o.booking_id!==o.checkout_booking_id))invalid();
  if(o.state==='cancelled'&&o.hold_state!=='released')invalid();
 }
 return{...o,bill_url:o.state==='due'?paymentUrl(o.bill_url):null};
}
export function safeBookingOrders(raw){if(!Array.isArray(raw)||raw.length>1000)invalid();const ids=new Set();return raw.map(o=>{const v=safeBookingOrder(o);if(ids.has(v.id))invalid();ids.add(v.id);return v;});}
export function needsPaymentCard(o,nativeIds=new Set()){return !o.booking_confirmed||!nativeIds.has(o.booking_id);}
export function checkoutClock(o,now=Date.now()){
 if(o.allocation_policy!==HOLD_POLICY)return null;
 const seconds=Math.max(0,Math.ceil((Date.parse(o.checkout_deadline)-now)/1000));
 const checking=!o.paid&&o.state!=='cancelled'&&(o.hold_state==='checking_bank'||o.hold_state==='held'&&seconds===0);
 return{seconds,checking,held:!o.paid&&o.hold_state==='held'&&seconds>0,released:o.hold_state==='released',text:Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')};
}
export function mayContinuePayment(o,now=Date.now()){const clock=checkoutClock(o,now);return !o.paid&&o.state==='due'&&!!o.bill_url&&(!clock||clock.held);}
export function paymentStatus(o,language='zh',now=Date.now()){
 const index=language==='en'?1:0,clock=checkoutClock(o,now);
 if(clock?.checking)return['正在核对银行结果·暂留未释放','Checking bank result · hold not released'][index];
 if(clock?.held)return['待付款·暂留一台机位 '+clock.text,'Awaiting payment · one station held '+clock.text][index];
 if(o.allocation_policy==='legacy_reserved'&&!o.booking_confirmed)return(o.paid?['旧订单已付款·查看原预约状态','Legacy payment received · check original booking']:['旧付款记录·请核对原账单','Legacy payment record · check original bill'])[index];
 if(o.paid&&!o.booking_confirmed&&o.state!=='paid_unallocated')return['已付款·预约状态变更·需人工核对','Paid · booking changed · staff review'][index];
 const labels={creating:['建立付款账单中·未占位','Preparing bill · no station held'],due:['待付款·未占位','Awaiting payment · no station held'],uncertain:['付款待核对·未占位','Payment review · no station held'],paid:['已付款·预约已确认','Paid · booking confirmed'],paid_unallocated:['已付款·未分配机位·退款待处理','Paid · no station allocated · refund review'],cancelled:['未付款订单已关闭','Unpaid order closed']};
 return labels[o.state]?.[index]||'—';
}
export function paymentHint(o,language='zh',now=Date.now()){
 const index=language==='en'?1:0,clock=checkoutClock(o,now);
 if(o.paid&&!o.booking_confirmed)return['GG已保留原收款记录，需人工核对退款或预约。请勿再次付款。','GG retains the original payment for booking or refund review. Do not pay again.'][index];
 if(o.booking_confirmed)return['已付款并确认机位。','Paid and station confirmed.'][index];
 if(clock?.checking)return['付款时间已到，正在核对原银行账单。服务器确认未付款账单关闭后才释放机位；请勿重复付款。','The payment window ended. The original bank bill is being checked. The station releases only after the server confirms the unpaid bill is closed. Do not pay again.'][index];
 if(clock?.held)return['进入FPX付款时暂留一台实际机位5分钟；付款成功后确认本台预约。','Entering FPX checkout temporarily holds one physical station for five minutes. Successful payment confirms that same booking.'][index];
 if(clock?.released&&o.state==='cancelled')return['服务器已确认原账单未付款并关闭，暂留机位已释放。','The server confirmed the original bill was unpaid and closed. The temporary station hold is released.'][index];
 return(o.allocation_policy==='legacy_reserved'?['旧预约付款记录，请核对原预约状态。','Legacy payment record. Check its original booking status.']:['这笔历史付款请求没有保留机位。','This historical payment request does not reserve a station.'])[index];
}
export function checkoutPolicyEnabled(catalog){return catalog?.allocation_policy===HOLD_POLICY&&catalog.pending_reserves_slot===true&&catalog.checkout_hold_seconds===300||catalog?.allocation_policy==='payment_success_only'&&catalog.pending_reserves_slot===false;}
export function reviewAllowed({loading,mutating,user,open,availabilityKnown,availableCount,start}){return !loading&&!mutating&&(!user||!open||availabilityKnown&&availableCount>0&&start!==null);}
export function bookingCheckoutCopy(catalog,language='zh',key='notice'){
 const index=language==='en'?1:0,hold=catalog?.allocation_policy===HOLD_POLICY;
 const copy=hold?{
  notice:['浏览、选时及TAC不占位。进入普通预约FPX付款时，暂留一台实际机位5分钟；付款成功才确认。','Browsing, choosing a time and TAC do not hold a station. Ordinary FPX checkout holds one physical station for five minutes; payment confirms the booking.'],
  review:['进入FPX付款时，服务器会为这个时段暂留一台机位5分钟。大厅3台PS5可分别同时结账；满位时不能建立付款账单。到时如银行结果未明，先核对原账单，不会重复收款。会员余额付款仍在TAC验证并扣款后才分配。','Entering FPX checkout holds one physical station for this time for five minutes. Three lobby PS5s can have independent checkouts; no bill is created when full. Unknown bank results retain the original bill for review. Member balance still allocates only after TAC verification and debit.'],
  summary:['FPX结账暂留5分钟；会员TAC不占位。','FPX checkout: five-minute hold. Member TAC: no hold.']
 }:{
  notice:['选择FPX或会员余额付款。付款前不保留机位，付款成功并分配后才确认预约。','Pay by FPX or member balance. No station is held before payment; successful payment and allocation confirm the booking.'],
  review:['选择FPX或会员余额。付款前不保留机位；请至少提前15分钟预约。如付款成功但无法分配时段，保留原付款并由GG核对退款。','Choose FPX or member balance. No station is held before payment. Book at least15 minutes ahead. If payment succeeds without allocation, GG retains the original payment for refund review.'],
  summary:['FPX或会员余额·付款前不保留机位。','FPX or member balance · no station held before payment.']
 };return copy[key]?.[index]||'';
}
