export function notificationLink(event){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(event?.source_id||''))return 'admin.html#overview';
 if(event.kind==='booking'&&(['paid_unallocated','payment_uncertain'].includes(event.summary?.payment)||uuid.test(event.summary?.payment_order_id||'')))return 'admin.html?payment_order='+(uuid.test(event.summary?.payment_order_id||'')?event.summary.payment_order_id:event.source_id)+'#booking';
 if(event.kind==='booking'&&event.summary?.payment==='gg_pass')return 'admin.html?booking='+event.source_id+'#passes';
 if(event.kind==='order'&&event.summary?.pass_sku==='GTA6_30X120_90D')return 'admin.html?order='+event.source_id+'#passes';
 if(event.kind==='booking'&&/^\d{4}-\d{2}-\d{2}$/.test(event.summary?.business_date||''))return 'admin.html?booking_date='+event.summary.business_date+'&booking='+event.source_id+'#booking';
 if(event.kind==='order')return 'admin.html?order='+event.source_id+'#orders';
 return 'admin.html#overview';
}
export function validNotificationFeed(data){return Number.isSafeInteger(data?.unread_count)&&data.unread_count>=0&&Array.isArray(data?.events)&&data.events.every(e=>Number.isSafeInteger(e.id)&&['booking','order','test'].includes(e.kind)&&typeof e.source_id==='string'&&e.summary&&typeof e.summary==='object');}


export function notificationTitle(event,t){const payment=event?.summary?.payment;return event?.kind==='booking'&&payment==='paid_unallocated'?t('已收款 · 未分配机位 · 退款待处理','Paid · no station allocated · refund review'):event?.kind==='booking'&&payment==='payment_uncertain'?t('付款／扣款结果待核对 · 非已确认预约','Payment / debit needs review · booking unconfirmed'):event?.kind==='booking'&&payment==='gg_pass'?t('游玩券预约','Play-pass booking'):event?.kind==='booking'?t('新预约 · 已付款','New booking · Paid'):event?.kind==='order'?t('新订单 · 已付款','New order · Paid'):t('通知测试','Notification test');}
