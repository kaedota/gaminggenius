const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES=new Set(['creating','due','uncertain','paid','paid_unallocated','cancelled']);
const invalid=()=>{throw Error('PAYMENT_RECORD_INVALID');};
export function paymentUrl(value){if(value===null||value===undefined)return null;let u;try{u=new URL(value);}catch{invalid();}if(u.protocol!=='https:'||u.hostname!=='www.billplz.com'||u.username||u.password||u.port||!/^\/bills\/[A-Za-z0-9_-]{1,64}$/.test(u.pathname)||u.search||u.hash||u.href!==value)invalid();return u.href;}
export function safeBookingOrder(o){
 if(!o||!UUID.test(o.id)||!STATES.has(o.state)||!['payment_success_only','legacy_reserved'].includes(o.allocation_policy)||!Number.isSafeInteger(o.total)||o.total<=0||typeof o.paid!=='boolean'||typeof o.booking_confirmed!=='boolean'||o.booking_id!==null&&!UUID.test(o.booking_id))invalid();
 if(!['PS5','Switch','Simulator28','Simulator38'].includes(o.pool)||!/^\d{4}-\d{2}-\d{2}$/.test(o.business_date)||!Number.isInteger(o.start_minute)||o.start_minute<0||o.start_minute>=1440||![60,120,180].includes(o.minutes)||!Number.isInteger(o.people)||o.people<1||o.people>4)invalid();
 if(o.booking_confirmed&&(!o.paid||!UUID.test(o.booking_id)||o.state!=='paid')||o.state==='paid'&&!o.paid||o.state==='paid_unallocated'&&(!o.paid||o.booking_confirmed||o.refund_state!=='review')||!['paid','paid_unallocated'].includes(o.state)&&o.paid)invalid();
 if(o.allocation_policy==='payment_success_only'&&o.booking_confirmed&&(o.booking_payment_status!=='paid'||!['confirmed','checked_in','completed'].includes(o.booking_status)))invalid();
 if(o.paid&&!o.booking_confirmed&&o.allocation_policy==='payment_success_only'&&(o.requires_staff_review!==true||o.refund_state!=='review'))invalid();
 const state={...o,bill_url:o.state==='due'?paymentUrl(o.bill_url):null};
 if(o.state==='paid_unallocated'&&o.requires_staff_review!==true)invalid();
 return state;
}
export function safeBookingOrders(raw){if(!Array.isArray(raw)||raw.length>1000)invalid();const ids=new Set();return raw.map(o=>{const v=safeBookingOrder(o);if(ids.has(v.id))invalid();ids.add(v.id);return v;});}
export function needsPaymentCard(o,nativeIds=new Set()){return !o.booking_confirmed||!nativeIds.has(o.booking_id);}
export function paymentStatus(o,language='zh'){const index=language==='en'?1:0;if(o.allocation_policy==='legacy_reserved'&&!o.booking_confirmed)return(o.paid?['旧订单已付款·查看原预约状态','Legacy payment received · check original booking']:['旧付款记录·请核对原账单','Legacy payment record · check original bill'])[index];if(o.paid&&!o.booking_confirmed&&o.state!=='paid_unallocated')return['已付款·预约状态变更·需人工核对','Paid · booking changed · staff review'][index];const labels={creating:['建立付款账单中·未占位','Preparing bill · no station held'],due:['待付款·未占位','Awaiting payment · no station held'],uncertain:['付款待核对·未占位','Payment review · no station held'],paid:['已付款·预约已确认','Paid · booking confirmed'],paid_unallocated:['已付款·未分配机位·退款待处理','Paid · no station allocated · refund review'],cancelled:['未付款订单已关闭','Unpaid order closed']};return labels[o.state]?.[index]||'—';}
