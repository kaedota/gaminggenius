const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const OWNER_TEST_SOURCE='owner_test_noncash',OWNER_TEST_LABEL='OWNER TEST · NO PAYMENT';
const invalid=()=>{throw Error('PASS_TEST_GRANT_RESPONSE_INVALID');};
export function safeOwnerTestGrant(raw){
 if(raw===undefined)return null;
 if(!raw||typeof raw.eligible!=='boolean')invalid();
 if(!raw.eligible)return{eligible:false};
 if(raw.source!==OWNER_TEST_SOURCE||raw.label!==OWNER_TEST_LABEL||raw.phone_last4!=='5291'||raw.total_uses!==30||raw.valid_days!==90||typeof raw.granted!=='boolean'||(raw.granted?!UUID.test(raw.pass_id):raw.pass_id!==null))invalid();
 return{eligible:true,source:OWNER_TEST_SOURCE,label:OWNER_TEST_LABEL,phone_last4:'5291',total_uses:30,valid_days:90,granted:raw.granted,pass_id:raw.pass_id};
}
export function safeOwnerTestGrantResult(raw){
 const p=raw?.pass,c=p?.counts;
 if(raw?.flow!=='gta_pass'||raw.dry_run===true||raw.issued!==true||typeof raw.new!=='boolean'||raw.noncash!==true||raw.is_test!==true||raw.source!==OWNER_TEST_SOURCE||raw.label!==OWNER_TEST_LABEL||raw.cash_cents!==0||!UUID.test(raw.pass_id)||p?.id!==raw.pass_id||p.source!==OWNER_TEST_SOURCE||p.is_test!==true||p.label!==OWNER_TEST_LABEL||p.total_uses!==30||Date.parse(p.expires_at)-Date.parse(p.valid_from)!==90*86400000||!c||['available','reserved','used','expired'].some(k=>!Number.isSafeInteger(c[k])||c[k]<0)||c.available+c.reserved+c.used+c.expired!==30||p.remaining_uses!==c.available)invalid();
 return{pass_id:raw.pass_id,new:raw.new};
}
// A retry retains its reference. The server additionally allows only one
// lifetime grant for the exact Owner, so no client retry can refill vouchers.
export class OwnerTestGrant{
 constructor({call,store,newId=()=>crypto.randomUUID()}){this.call=call;this.store=store;this.newId=newId;this.requestId=null;this.busy=false;this.uncertain=false;this.key='gg-owner-test-grant-reference-v1';try{const value=store?.getItem(this.key);if(value&&UUID.test(value))this.requestId=value;}catch{}}
 async submit(){if(this.busy)return null;this.busy=true;try{if(!this.requestId){this.requestId=this.newId();if(!UUID.test(this.requestId))throw Error('PASS_RANDOM_FAILED');try{this.store?.setItem(this.key,this.requestId);}catch{}}
  const result=safeOwnerTestGrantResult(await this.call('gta_pass_owner_test_grant',{request_id:this.requestId}));this.uncertain=false;return result;
 }catch(error){this.uncertain=true;throw error;}finally{this.busy=false;}}
}
