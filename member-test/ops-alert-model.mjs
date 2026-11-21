export function notificationLink(event){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(event?.source_id||''))return 'admin.html#overview';
 if(event.kind==='booking'&&/^\d{4}-\d{2}-\d{2}$/.test(event.summary?.business_date||''))return 'admin.html?booking_date='+event.summary.business_date+'&booking='+event.source_id+'#booking';
 if(event.kind==='order')return 'admin.html?order='+event.source_id+'#orders';
 return 'admin.html#overview';
}
export function validNotificationFeed(data){return Number.isSafeInteger(data?.unread_count)&&data.unread_count>=0&&Array.isArray(data?.events)&&data.events.every(e=>Number.isSafeInteger(e.id)&&['booking','order','test'].includes(e.kind)&&typeof e.source_id==='string'&&e.summary&&typeof e.summary==='object');}

