// Reuse the exact existing public GG auth client, configuration and MFA helper.
// No phone, member fixture, test TAC, Owner ID, password or SMS key is embedded.
import {connect} from '../api.js';
import config from '../config.js';
import {selectTotpFactor} from '../mfa-state.js';
import {mountTacFlow} from './tac-flow.mjs?v=owner-ux-v4';
import {createOwnerPilotCall,createSafeOwnerPilotCall,createReadonlyRecoveryQuery,clearExpiredOwnerPending,archiveNoRecordOwnerPending,safeStartError,authenticatedIdentityText,recoveryNotice} from './pilot-api.mjs?v=owner-ux-v4';

let lang='zh';try{lang=localStorage.getItem('gg-language')==='en'?'en':'zh';}catch{}
if(new URL(location.href).searchParams.get('lang')==='en')lang='en';
const t=(zh,en)=>lang==='zh'?zh:en;
const root=document.getElementById('owner-root');
const recoveryRoot=document.getElementById('owner-recovery'),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let client,flow,active=true,generation=0,accessEpoch=0,busy=false,unsubscribe,currentUserId,authenticatedIdentity=null,rawCall,pilotCall,queryRecovery,requestBusy=false,networkInFlight=0;
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
function labels(){document.documentElement.lang=lang==='zh'?'zh-Hans':'en';
  for(const[id,text]of Object.entries({'owner-label':t('OWNER专用 · 只读测试','OWNER ONLY · READ-ONLY TEST'),
    'owner-title':t('会员TAC只读测试','Read-only membership TAC test'),
    'owner-note':t('只向已获准的本人号码发送真实短信。发送核对最多约2分钟；结果不明确时不会自动重发。不绑定会员、不扣余额或积分、不建立预约。','Real SMS is limited to the approved owner’s number. Sending and verification can take about 2 minutes; an unclear result never triggers an automatic resend. No membership link, debit or booking.'),
    'owner-footer':t('本页未加入官网导航。服务器仍会检查Owner身份、工作人员双重验证及测试号码；页面网址本身不授予权限。','This page is unlinked. The server checks Owner identity, staff two-factor verification and the approved number. The URL grants no access.')}))document.getElementById(id).textContent=text;
  document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
  showIdentity();
}
function showIdentity(){const element=document.getElementById('owner-identity');element.textContent=authenticatedIdentityText(authenticatedIdentity,lang);element.hidden=!element.textContent;}
function friendly(error){
  const code=error?.message||'';
  if(/MFA|aal/i.test(code))return t('请填写验证器当前6位数字。不要使用短信TAC填写这里。','Enter the current 6-digit authenticator code here, not the SMS TAC.');
  if(/AUTH_REQUIRED|JWT|expired/.test(code))return t('请先在同一标签页登录你的GG Owner账号，再返回本页重新检查。','Sign in to your GG Owner account in this tab, then return and check again.');
  if(/ADMIN_REQUIRED|permission denied/.test(code))return t('此账号未通过工作人员验证。请使用现有Owner账号。','Staff verification failed for this account. Use the existing Owner account.');
  return t('无法完成身份检查。请重新检查，或回到GG登录页。','Identity verification could not be completed. Check again or return to GG sign-in.');
}
function button(text,action){const b=el('button',text,'gg-tac-button');b.type='button';b.addEventListener('click',action);return b;}
function clear(){flow?.dispose();flow=null;root.replaceChildren();}
function pendingKey(){if(!currentUserId)throw Error('AUTH_REQUIRED');return 'gg-owner-tac-pending-v1:'+currentUserId;}
function pendingRecord(){const raw=sessionStorage.getItem(pendingKey());try{const record=UUID.test(raw||'')?{request_id:raw}:JSON.parse(raw);return UUID.test(record?.request_id||'')?{request_id:record.request_id,ownerId:record.ownerId??currentUserId,purpose:record.purpose??'link',dry_run:record.dry_run??true,kind:record.kind??'owner_link_tac_dry_run',start_error_code:safeStartError(record.start_error_code)}:null;}catch{return null;}}
function pending(){return pendingRecord()?.request_id||null;}
function savePending(id){if(!UUID.test(id||''))throw Error('INVALID_INPUT');try{sessionStorage.setItem(pendingKey(),JSON.stringify({request_id:id,ownerId:currentUserId,purpose:'link',dry_run:true,kind:'owner_link_tac_dry_run'}));}catch{throw Error('TAC_RECOVERY_STORAGE_REQUIRED');}}
function saveStartFailure(id,code){const record=pendingRecord();if(record?.request_id===id&&safeStartError(code))sessionStorage.setItem(pendingKey(),JSON.stringify({...record,start_error_code:code}));}
function historyKey(){if(!currentUserId)throw Error('AUTH_REQUIRED');return 'gg-owner-tac-history-v1:'+currentUserId;}
function historyRecords(){const rows=JSON.parse(sessionStorage.getItem(historyKey())||'[]');if(!Array.isArray(rows))throw Error('TAC_RECOVERY_STORAGE_REQUIRED');return rows;}
function saveHistory(entry){const rows=historyRecords();sessionStorage.setItem(historyKey(),JSON.stringify([...rows,entry]));}
function renderHistory(box){
  try{const rows=historyRecords().filter(row=>row?.ownerId===currentUserId&&row.status==='no_record_at_check'&&UUID.test(row.request_id||''));if(!rows.length)return;
    const details=el('details'),summary=el('summary',t('保留的原测试请求（不代表未发送）','Retained original test requests (not proof of non-delivery)'));details.append(summary);
    for(const row of rows)details.append(el('p',row.request_id+' · no_record_at_check · '+String(row.checked_at||''),'gg-tac-note'));
    box.append(details);
  }catch{box.append(el('p',t('本地历史暂时无法读取；不会清除原请求。','Local history is unavailable; the original request will not be cleared.'),'gg-tac-error'));}
}
function recoveryTools(id){
  recoveryRoot.replaceChildren();const box=el('section',undefined,'gg-tac-card gg-tac'),label=el('label',t('恢复原发送请求（只查询，不重发短信）','Recover original request (read only, no SMS resend)')),input=el('input');
  input.type='text';input.autocomplete='off';input.spellcheck=false;input.maxLength=36;input.value=id||'';input.placeholder='request_id UUID';label.append(input);
  const query=button(t('只查询原请求','Query original request only'),()=>void recoverRequest(input.value.trim()));query.dataset.recoveryQuery='';
  const status=el('p',requestBusy?t('正在发送并核对，请等待；不会自动重发。','Sending and checking. Please wait; no automatic resend.'):'','gg-tac-note');status.dataset.recoveryProgress='';
  box.append(label,query,status,el('p',t('请求编号不含TAC。查看其他编号不会覆盖已保存的发送请求，也不会创建请求或延长有效期。','The reference contains no TAC. Querying another reference never replaces the saved send request, creates a request or extends expiry.'),'gg-tac-note'));
  const saved=pending();if(saved)box.append(el('p',t('已保存的发送请求：','Saved send request: ')+saved,'gg-tac-note'));
  renderHistory(box);
  recoveryRoot.append(box);setRequestBusy(requestBusy);
}
function setRequestBusy(value){requestBusy=value;const b=recoveryRoot.querySelector('[data-recovery-query]');if(b)b.disabled=value||networkInFlight>0;const archive=root.querySelector('[data-owner-archive]');if(archive)archive.disabled=value||networkInFlight>0;const p=recoveryRoot.querySelector('[data-recovery-progress]');if(p)p.textContent=value?t('正在发送并核对，请等待（最多约2分钟）；不会自动重发。','Sending and checking (up to about 2 minutes). No automatic resend.') : '';}
function recoveryMessage(title,message,id,denial=''){clear();const card=el('section',undefined,'gg-tac-card');card.append(el('h2',title),el('p',message,'gg-tac-note'),el('p',t('本次请求编号：','Request reference: ')+id,'gg-tac-note'));if(denial)card.append(el('p',denial,'gg-tac-error'));root.append(card);}
async function showRecovered(meta){
  if(!active||!currentUserId)return;
  const saved=pendingRecord();if(saved?.request_id===meta.request_id&&saved.start_error_code&&!meta.start_error_code)meta={...meta,start_error_code:saved.start_error_code};
  const notice=recoveryNotice(meta,lang);
  const token=++generation;clear();recoveryTools(meta.request_id);
  if(meta.recoveryUnavailable){recoveryMessage(t('发送结果仍待核对','Sending result is still unconfirmed'),t('状态查询暂时不可用，这不代表发送失败。不会重发短信，请只查询原请求或联系工作人员。','Status is temporarily unavailable; this does not mean sending failed. No SMS will be resent. Query the original request or contact staff.'),meta.request_id,notice.denial);return;}
  if(meta.found===false){recoveryMessage(notice.title,notice.message,meta.request_id,notice.denial);
    if(pending()===meta.request_id){const card=root.querySelector('section');
      card.append(el('p',t('另开测试会先保留原编号及本次“未找到记录”的查询证据，不确认原短信送达、失败或取消。这里只返回号码输入；下一次仍需单独点击发送，并受服务器额度限制。','Preparing another test first retains the original reference and this no-record query evidence. It does not confirm delivery, failure or cancellation. This only returns to phone entry; sending still needs a separate click and server quota approval.'),'gg-tac-note'));
      const prepare=button(t('另开一笔测试（保留原请求，不发短信）','Prepare another test (keep original; no SMS)'),()=>{
        if(!active||!currentUserId)return;
        try{if(!archiveNoRecordOwnerPending(meta,{ownerId:currentUserId,loadPendingRecord:pendingRecord,saveHistory,clearPending:()=>sessionStorage.removeItem(pendingKey()),inFlight:requestBusy||networkInFlight>0}))return;
          ++generation;clear();recoveryTools('');flow=mountTacFlow(root,{call:pilotCall,context:{purpose:'link'},language:lang,demo:false});
        }catch{recoveryMessage(t('未能保留原请求','Could not retain the original request'),t('无法保存查询证据，因此没有准备新测试，也不会发送短信。','The evidence could not be saved. No new test was prepared and no SMS will be sent.'),meta.request_id);}
      });prepare.dataset.ownerArchive='';card.append(prepare);setRequestBusy(requestBusy);
    }return;
  }
  if(meta.can_verify&&meta.expires_in>0){flow=mountTacFlow(root,{call:pilotCall,context:{purpose:'link'},language:lang,demo:false,recovered:meta});return;}
  if(meta.found&&meta.delivery_state==='verified_dry_run'){
    try{const result=await rawCall('read_tac_result',{challenge_id:meta.challenge_id,request_id:meta.request_id});if(!active||token!==generation)return;flow=mountTacFlow(root,{call:pilotCall,context:{purpose:'link'},language:lang,demo:false,recovered:{...meta,result}});return;}
    catch{if(!active||token!==generation)return;}
  }
  const expired=meta.found&&(meta.state==='expired'||meta.expires_in===0);
  recoveryMessage(t(expired?'原TAC已过期':'原发送请求已保留',expired?'The original TAC has expired':'Original request retained'),
    expired?t('有效期已经结束，不会延长或重发短信。请先核对发送记录，再决定下一步。','The validity period has ended. It will not be extended and no SMS will be resent. Review the sending record before deciding the next step.'):
    t('发送结果未确认或请求仍在处理中。这里只能手动查询原请求，不会发送新短信。','Sending is unconfirmed or still processing. This page only queries the original request manually; it sends no new SMS.'),meta.request_id,notice.denial);
  if(meta.found&&meta.state==='expired'&&meta.expires_in===0&&meta.can_verify===false&&pending()===meta.request_id){
    const card=root.querySelector('section');
    card.append(el('p',t('下方只回到号码输入。仍须再次点击「发送TAC」才会发送另一条短信；不会自动发送。','The button below only returns to phone entry. Another SMS is sent only after a separate click on “Send TAC”. Nothing is sent automatically.'),'gg-tac-note'),
      button(t('开始新一次测试（会另发一条短信）','Start a new test (another SMS)'),()=>{
        if(requestBusy||networkInFlight>0||!active||!currentUserId)return;
        try{
          if(!clearExpiredOwnerPending(meta,{loadPending:pending,clearPending:()=>sessionStorage.removeItem(pendingKey()),inFlight:requestBusy||networkInFlight>0}))return;
          ++generation;clear();recoveryTools('');flow=mountTacFlow(root,{call:pilotCall,context:{purpose:'link'},language:lang,demo:false});
        }catch{recoveryMessage(t('无法清除过期测试记录','Cannot clear the expired test reference'),t('不会发送短信，请检查浏览器储存设置后重新查询原请求。','No SMS will be sent. Check browser storage settings and query the original request again.'),meta.request_id);}
      }));
  }
}
async function recoverRequest(id){
  if(requestBusy||!UUID.test(id)){if(!UUID.test(id))recoveryMessage(t('请输入完整请求编号','Enter the full request reference'),t('格式为UUID；不要填写电话号码或短信TAC。','Use the request UUID, not a phone number or SMS TAC.'),id);return;}
  const ownerEpoch=accessEpoch;setRequestBusy(true);clear();root.append(el('p',t('正在只读查询原请求；不会发送短信…','Reading the original request; no SMS is being sent…'),'gg-tac-note'));
  try{const meta=await queryRecovery(id);if(active&&ownerEpoch===accessEpoch)await showRecovered(meta);}
  catch{if(active&&ownerEpoch===accessEpoch)await showRecovered({request_id:id,recoveryUnavailable:true});}finally{setRequestBusy(false);}
}
function gate(error,mfa=false){
  clear();recoveryRoot.replaceChildren();const card=el('section',undefined,'gg-tac-card gg-tac');
  card.append(el('h2',t(mfa?'工作人员双重验证':'请确认Owner登录',mfa?'Staff two-factor verification':'Confirm Owner sign-in')),el('p',friendly(error),'gg-tac-note'));
  const status=el('p','','gg-tac-error');status.setAttribute('role','status');
  if(mfa){const form=el('form'),label=el('label',t('验证器代码（不是短信TAC）','Authenticator code (not the SMS TAC)')),input=el('input');input.type='text';input.inputMode='numeric';input.pattern='[0-9]{6}';input.minLength=6;input.maxLength=6;input.autocomplete='one-time-code';input.required=true;label.append(input);
    const submit=button(t('验证并继续','Verify and continue'),()=>{});submit.type='submit';form.append(label,submit);form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!form.reportValidity())return;busy=true;submit.disabled=true;const code=input.value;input.value='';
      try{const{data,error}=await client.auth.mfa.listFactors();if(error)throw error;const factor=selectTotpFactor(data);if(!factor||factor.status!=='verified')throw Error('MFA_REQUIRED');const result=await client.auth.mfa.challengeAndVerify({factorId:factor.id,code});if(result.error)throw result.error;busy=false;await load();}
      catch(err){status.textContent=friendly(err);}finally{busy=false;submit.disabled=false;}});card.append(form);
  }
  const sign=el('a',t('前往GG登录','Go to GG sign-in'),'gg-tac-button secondary');sign.href='../index.html?mode=login';
  card.append(status,sign,button(t('重新检查登录','Check sign-in again'),()=>void load()));root.append(card);
}
async function load(){
  if(!active||busy)return;const token=++generation,ownerEpoch=++accessEpoch;currentUserId=null;authenticatedIdentity=null;showIdentity();clear();recoveryRoot.replaceChildren();root.append(el('p',t('正在检查GG身份与双重验证…','Checking GG identity and two-factor verification…'),'gg-tac-note'));
  try{client??=await connect({manualCallback:true});const{data,error}=await client.auth.getUser();if(error||!data?.user)throw Error('AUTH_REQUIRED');
    if(!active||token!==generation)return;authenticatedIdentity={email:data.user.email};showIdentity();
    const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)throw assurance.error;if(assurance.data?.currentLevel!=='aal2')throw Error('MFA_REQUIRED');
    const staff=await client.rpc('gg_pospal_staff_access');if(staff.error)throw staff.error;if(staff.data!==true)throw Error('ADMIN_REQUIRED');
    if(!active||token!==generation)return;
    currentUserId=data.user.id;const transport=createOwnerPilotCall(client,config);
    rawCall=async(action,payload)=>{networkInFlight++;setRequestBusy(requestBusy);try{return await transport(action,payload);}finally{networkInFlight--;setRequestBusy(requestBusy);}};queryRecovery=createReadonlyRecoveryQuery(rawCall);
    const safeCall=createSafeOwnerPilotCall(rawCall,{loadPending:pending,savePending,saveStartFailure,onRecovery:meta=>{if(active&&ownerEpoch===accessEpoch)void showRecovered(meta);}});
    pilotCall=async(action,payload)=>{if(action!=='start_tac')return safeCall(action,payload);setRequestBusy(true);try{return await safeCall(action,payload);}finally{setRequestBusy(false);}};
    const saved=pending();recoveryTools(saved);
    if(saved)recoveryMessage(t('发现原发送请求','Original request found'),t('本页不会重新发短信。请点击下方「只查询原请求」恢复状态。','No SMS will be resent. Use “Query original request only” below to recover the status.'),saved);
    else flow=mountTacFlow(root,{call:pilotCall,context:{purpose:'link'},language:lang,demo:false});
  }catch(error){if(active&&token===generation)gate(error,/MFA_REQUIRED/.test(error?.message||''));}
}
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;labels();if(flow)flow.setLanguage(lang);else void load();}));
labels();await load();
if(client){const subscription=client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++generation;++accessEpoch;currentUserId=null;authenticatedIdentity=null;showIdentity();flow?.signOut();gate(Error('AUTH_REQUIRED'));}});unsubscribe=()=>subscription?.data?.subscription?.unsubscribe();}
window.addEventListener('pagehide',()=>{active=false;++generation;++accessEpoch;currentUserId=null;authenticatedIdentity=null;showIdentity();flow?.dispose();root.replaceChildren();recoveryRoot.replaceChildren();unsubscribe?.();});
