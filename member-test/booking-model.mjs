export function businessToday(now=new Date()){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const part=k=>parts.find(p=>p.type===k).value;return`${part('year')}-${part('month')}-${part('day')}`;}
export function addDays(date,n){const d=new Date(date+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()+n);return businessToday(d);}
export function bounds(date){const day=new Date(date+'T12:00:00+08:00').getUTCDay();return day===0||day===6?{open:660,close:1500}:{open:780,close:1440};}
export function slotStart(date,start){return new Date(date+'T00:00:00+08:00').valueOf()+start*60000;}
export function validStarts(date,minutes,now=Date.now()){const {open,close}=bounds(date);return Array.from({length:Math.max(0,Math.floor((close-open-minutes)/60)+1)},(_,i)=>open+i*60).filter(m=>slotStart(date,m)>now);}
export function overlaps(rows,station,date,start,minutes){const a=slotStart(date,start),b=a+minutes*60000;return rows.some(r=>r.station_id===station&&Date.parse(r.start_at)<b&&Date.parse(r.end_at)>a);}
export function money(cents){return'RM'+(cents/100).toFixed(cents%100?2:0);}
export function selectionKey(s){return[s.type||s.station?.split('-')[0],s.date,s.start,s.minutes,s.people].join('|');}

