const PURPOSES=new Set(['lookup','booking_balance','booking_points']),FIELDS=['station','date','startMinute','minutes','people'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid=value=>typeof value==='string'&&UUID.test(value);
export function normalizePhone(value){let phone=String(value??'').replace(/[ ().-]/g,'');if(/^0[1-9][0-9]{7,9}$/.test(phone))phone='+60'+phone.slice(1);else if(/^60[1-9][0-9]{7,9}$/.test(phone))phone='+'+phone;if(!/^\+601[0-9]{8,9}$/.test(phone))throw Error('INVALID_PHONE');return phone;}
export function contextKey(context){
 if(!PURPOSES.has(context?.purpose))throw Error('INVALID_CONTEXT');
 const booking=context.purpose==='lookup'?null:Object.fromEntries(FIELDS.map(k=>[k,context.booking?.[k]]));
 if(booking&&(!['PS5','Switch','SIM01','SIM02'].includes(booking.station)||!/^\d{4}-\d{2}-\d{2}$/.test(booking.date)||!Number.isInteger(booking.startMinute)||booking.startMinute<0||booking.startMinute>=1440||!Number.isInteger(booking.minutes)||booking.minutes<=0||!Number.isInteger(booking.people)||booking.people<1||booking.people>4))throw Error('INVALID_CONTEXT');
 return JSON.stringify({purpose:context.purpose,booking});
}
export function safeReview(review,context){
 const m=review?.member;if(!m||typeof m.number!=='string'||!m.number||m.number.length>100||typeof m.name!=='string'||!m.name||m.name.length>128||!Number.isFinite(Number(m.balance))||!Number.isFinite(Number(m.points)))throw Error('TAC_RESPONSE_INVALID');
 const member={number:m.number,name:m.name,balance:Number(m.balance),points:Number(m.points)};
 if(context.purpose==='lookup'){if(review.quote!==null)throw Error('TAC_RESPONSE_INVALID');return{member,quote:null};}
 const q=review.quote;if(!q||q.purpose!==context.purpose||FIELDS.some(k=>q[k]!==context.booking[k])||!Number.isSafeInteger(q.cents)||q.cents<=0||!Number.isSafeInteger(q.points)||q.points<0)throw Error('TAC_DETAILS_CHANGED');
 return{member,quote:{...Object.fromEntries(FIELDS.map(k=>[k,q[k]])),purpose:q.purpose,cents:q.cents,points:q.points}};
}
