const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const resources={
 'hall-1':{station_id:'PS5-1',kind:'lobby'},'hall-2':{station_id:'PS5-2',kind:'lobby'},'hall-3':{station_id:'PS5-3',kind:'lobby'},
 'room-onepiece':{station_id:'PS5Room-OnePiece',kind:'room'}
};
export const ASSIGNMENT_KEY='gg.pass.staff.assignment.v1';
const fail=()=>{throw Error('PASS_ASSIGNMENT_RESPONSE_INVALID');};
export function assignmentMeta(booking){
 if(booking?.assignment_enabled===undefined)return{enabled:false,canAssign:false,options:[]};
 if(typeof booking.assignment_enabled!=='boolean'||typeof booking.can_assign!=='boolean'||!Number.isSafeInteger(booking.assignment_version)||booking.assignment_version<1||!resources[booking.assigned_resource_id]||resources[booking.assigned_resource_id].station_id!==booking.assigned_station_id||!Array.isArray(booking.assignment_options)||booking.assignment_options.length>3)fail();
 const seen=new Set(),options=booking.assignment_options.map(x=>{
  const rule=resources[x?.resource_id];
  if(!rule||rule.station_id!==x.station_id||rule.kind!==x.kind||x.enabled!==true||x.source_verified!==true||seen.has(x.resource_id)||x.resource_id===booking.assigned_resource_id)fail();
  seen.add(x.resource_id);return{...x};
 });
 return{enabled:booking.assignment_enabled,canAssign:booking.assignment_enabled&&booking.can_assign&&booking.state==='reserved'&&booking.booking?.confirmed===true&&!booking.device&&options.length>0,version:booking.assignment_version,resource_id:booking.assigned_resource_id,station_id:booking.assigned_station_id,options};
}
function validPending(p){return p&&UUID.test(p.request_id)&&UUID.test(p.booking_id)&&resources[p.resource_id]&&Number.isSafeInteger(p.version)&&p.version>0&&typeof p.reason==='string'&&p.reason.trim().length>0&&p.reason.length<=200;}
export function assignmentReceipt(raw,p){
 if(typeof raw?.new!=='boolean')fail();
 if(raw?.flow!=='gta_pass'||raw.request_id!==p.request_id||raw.assignment?.booking_id!==p.booking_id||raw.assignment.resource_id!==p.resource_id||raw.assignment.station_id!==resources[p.resource_id]?.station_id||raw.assignment.previous_version!==p.version||raw.assignment.version!==p.version+1||raw.redemption?.booking?.id!==p.booking_id||raw.redemption.booking.minutes!==120||raw.redemption.cash_due_cents!==0)fail();
 const current=raw.current,rule=resources[current?.resource_id];
 if(!rule||rule.station_id!==current.station_id||!Number.isSafeInteger(current.version)||current.version<p.version+1||!['confirmed','checked_in','completed','cancelled','expired','no_show'].includes(current.status)||(current.version===p.version+1&&current.resource_id!==p.resource_id))fail();
 return{assignment:raw.assignment,current,redemption:raw.redemption};
}
export class AssignmentActions{
 constructor({call,store,uuid=()=>crypto.randomUUID()}){
  this.call=call;this.store=store;this.uuid=uuid;this.pending=new Map();this.storageReview=!store;
  try{const raw=store?.getItem(ASSIGNMENT_KEY);if(raw!==null&&raw!==undefined){const parsed=JSON.parse(raw);if(parsed?.version!==1||!Array.isArray(parsed.entries)||parsed.entries.length>100||parsed.entries.some(p=>!validPending(p))||new Set(parsed.entries.map(p=>p.booking_id)).size!==parsed.entries.length)throw Error('INVALID_STORAGE');for(const p of parsed.entries)this.pending.set(p.booking_id,p);}}
  catch{this.storageReview=true;}
 }
 save(){try{if(!this.store)throw Error('NO_STORAGE');this.store.setItem(ASSIGNMENT_KEY,JSON.stringify({version:1,entries:[...this.pending.values()]}));}catch{this.storageReview=true;throw Error('PASS_ASSIGNMENT_STORAGE_REVIEW');}}
 finish(booking_id){
  try{this.store.setItem(ASSIGNMENT_KEY,JSON.stringify({version:1,entries:[...this.pending.values()].filter(p=>p.booking_id!==booking_id)}));}
  catch{this.storageReview=true;throw Error('PASS_ASSIGNMENT_STORAGE_REVIEW');}
  this.pending.delete(booking_id);
 }
 async submit(booking,resource_id,reason){
  if(this.storageReview)throw Error('PASS_ASSIGNMENT_STORAGE_REVIEW');
  const meta=assignmentMeta(booking);if(!meta.canAssign||!meta.options.some(x=>x.resource_id===resource_id)||this.pending.has(booking.booking.id))throw Error('PASS_ASSIGNMENT_NOT_ALLOWED');
  const p={booking_id:booking.booking.id,resource_id,version:meta.version,reason:reason?.trim(),request_id:this.uuid()};if(!validPending(p))throw Error('INVALID_INPUT');
  this.pending.set(p.booking_id,p);this.save();
  const raw=await this.call('gta_pass_staff_assign',p),result=assignmentReceipt(raw,p);
  this.finish(p.booking_id);return result;
 }
 async recover(booking_id){
  if(this.storageReview)throw Error('PASS_ASSIGNMENT_STORAGE_REVIEW');const p=this.pending.get(booking_id);if(!p)throw Error('PASS_ASSIGNMENT_NOT_PENDING');
  const raw=await this.call('gta_pass_staff_assign_get',{request_id:p.request_id});
  if(raw?.flow!=='gta_pass'||raw.request_id!==p.request_id||typeof raw.found!=='boolean')fail();
  if(!raw.found)return{found:false};const result=assignmentReceipt(raw,p);
  this.finish(booking_id);return{found:true,...result};
 }
}
