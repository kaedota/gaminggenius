// Reuse the exact existing public GG auth client, configuration and MFA helper.
// No phone, member fixture, test TAC, Owner ID, password or SMS key is embedded.
import {connect} from '../api.js';
import config from '../config.js';
import {selectTotpFactor} from '../mfa-state.js';
import {mountTacFlow} from './tac-flow.mjs';
import {createOwnerPilotCall} from './pilot-api.mjs';

let lang='zh';try{lang=localStorage.getItem('gg-language')==='en'?'en':'zh';}catch{}
if(new URL(location.href).searchParams.get('lang')==='en')lang='en';
const t=(zh,en)=>lang==='zh'?zh:en;
const root=document.getElementById('owner-root');
let client,flow,active=true,generation=0,busy=false,unsubscribe;
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
function labels(){document.documentElement.lang=lang==='zh'?'zh-Hans':'en';
  for(const[id,text]of Object.entries({'owner-label':t('OWNER专用 · 只读测试','OWNER ONLY · READ-ONLY TEST'),
    'owner-title':t('会员TAC只读测试','Read-only membership TAC test'),
    'owner-note':t('只向已获准的本人号码发送真实短信。正确验证后读取会员资料；不绑定会员、不扣余额或积分、不建立预约。','A real SMS is sent only to the approved owner’s number. Verification reads membership details only. No membership link, balance/points debit or booking is created.'),
    'owner-footer':t('本页未加入官网导航。服务器仍会检查Owner身份、工作人员双重验证及测试号码；页面网址本身不授予权限。','This page is unlinked. The server checks Owner identity, staff two-factor verification and the approved number. The URL grants no access.')}))document.getElementById(id).textContent=text;
  document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
}
function friendly(error){
  const code=error?.message||'';
  if(/MFA|aal/i.test(code))return t('请填写验证器当前6位数字。不要使用短信TAC填写这里。','Enter the current 6-digit authenticator code here, not the SMS TAC.');
  if(/AUTH_REQUIRED|JWT|expired/.test(code))return t('请先在同一标签页登录你的GG Owner账号，再返回本页重新检查。','Sign in to your GG Owner account in this tab, then return and check again.');
  if(/ADMIN_REQUIRED|permission denied/.test(code))return t('此账号未通过工作人员验证。请使用现有Owner账号。','Staff verification failed for this account. Use the existing Owner account.');
  return t('无法完成身份检查。请重新检查，或回到GG登录页。','Identity verification could not be completed. Check again or return to GG sign-in.');
}
function button(text,action){const b=el('button',text,'gg-tac-button');b.type='button';b.addEventListener('click',action);return b;}
function clear(){flow?.dispose();flow=null;root.replaceChildren();}
function gate(error,mfa=false){
  clear();const card=el('section',undefined,'gg-tac-card gg-tac');
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
  if(!active||busy)return;const token=++generation;clear();root.append(el('p',t('正在检查GG身份与双重验证…','Checking GG identity and two-factor verification…'),'gg-tac-note'));
  try{client??=await connect({manualCallback:true});const{data,error}=await client.auth.getUser();if(error||!data?.user)throw Error('AUTH_REQUIRED');
    const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)throw assurance.error;if(assurance.data?.currentLevel!=='aal2')throw Error('MFA_REQUIRED');
    const staff=await client.rpc('gg_pospal_staff_access');if(staff.error)throw staff.error;if(staff.data!==true)throw Error('ADMIN_REQUIRED');
    if(!active||token!==generation)return;
    flow=mountTacFlow(root,{call:createOwnerPilotCall(client,config),context:{purpose:'link'},language:lang,demo:false});
  }catch(error){if(active&&token===generation)gate(error,/MFA_REQUIRED/.test(error?.message||''));}
}
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;labels();if(flow)flow.setLanguage(lang);else void load();}));
labels();await load();
if(client){const subscription=client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++generation;flow?.signOut();gate(Error('AUTH_REQUIRED'));}});unsubscribe=()=>subscription?.data?.subscription?.unsubscribe();}
window.addEventListener('pagehide',()=>{active=false;++generation;flow?.dispose();root.replaceChildren();unsubscribe?.();});
