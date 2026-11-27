import{selectTotpFactor}from'../../mfa-state.js';
import{acceptsOwnerIdentity}from'./live-api.mjs?v=owner-live-v2';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export async function requireOwnerAccess(client,call){
  const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)throw assurance.error;if(assurance.data?.currentLevel!=='aal2')throw Error('MFA_REQUIRED');
  const result=await call('live_tac_access',{});if(!acceptsOwnerIdentity(result))throw Error('TAC_OWNER_ACCEPTANCE_CLOSED');return result;
}
export function appendOwnerIdentity(root,email,t){
  root.querySelector('[data-owner-account]')?.remove();if(typeof email!=='string'||!email.includes('@'))return;
  const label=el('p',t('GG 登录账号：','GG signed-in account: ')+email,'owner-tac-account');label.dataset.ownerAccount='';
  const main=root.querySelector('main');if(main)main.prepend(label);else root.prepend(label);
}
export function renderOwnerGate(root,{client,user,error,t,retry}){
  root.replaceChildren();const card=el('main',undefined,'owner-tac-gate');card.append(el('h1',t('Owner会员预约验收','Owner membership booking acceptance')));
  if(user?.email)card.append(el('p',t('GG 登录账号：','GG signed-in account: ')+user.email,'owner-tac-account'));
  const mfa=/MFA_REQUIRED|STAFF_MFA_REQUIRED/.test(error?.message||'');
  card.append(el('p',mfa?t('请用现有验证器完成工作人员双重验证。这里不是短信TAC输入。','Complete staff two-factor verification using your existing authenticator. This is not the SMS TAC field.'):
    t('此页面仅供服务器批准的Owner验收。当前尚未通过访问检查，不会发送短信或扣款。','This page is for server-approved Owner acceptance only. Access is not approved, so no SMS or debit is started.')));
  const hints={AUTH_REQUIRED:t('AUTH_REQUIRED：请先在同一标签页登录现有GG账号。','AUTH_REQUIRED: sign in to the existing GG account in this tab.'),
    RATE_LIMITED:t('RATE_LIMITED：请员工核对冷却及测试额度；不会自动重试。','RATE_LIMITED: ask staff to check cooldown and test limits. No automatic retry.'),
    TAC_OWNER_ACCEPTANCE_CLOSED:t('Owner验收门尚未开放（TAC_OWNER_ACCEPTANCE_CLOSED）。','Owner acceptance is closed (TAC_OWNER_ACCEPTANCE_CLOSED).'),
    TAC_LIVE_NOT_OPEN:t('服务器金融验收尚未开放（TAC_LIVE_NOT_OPEN）。','Server financial acceptance is closed (TAC_LIVE_NOT_OPEN).'),
    TAC_SERVICE_UNAVAILABLE:t('服务查询未确认（TAC_SERVICE_UNAVAILABLE）；请重新检查访问权限，不会发送短信。','The service query is unconfirmed (TAC_SERVICE_UNAVAILABLE). Check access again; no SMS is sent.')};
  if(hints[error?.message])card.append(el('p',hints[error.message],'gg-tac-note'));
  const status=el('p','','gg-tac-error');status.setAttribute('role','status');
  if(mfa&&client){const form=el('form'),label=el('label',t('验证器当前6位代码','Current 6-digit authenticator code')),input=el('input');input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.pattern='[0-9]{6}';input.maxLength=6;input.required=true;label.append(input);const button=el('button',t('验证并继续','Verify and continue'));button.type='submit';
    form.append(label,button);form.addEventListener('submit',async event=>{event.preventDefault();if(button.disabled||!form.reportValidity())return;button.disabled=true;const code=input.value;input.value='';
      try{const{data,error}=await client.auth.mfa.listFactors();if(error)throw error;const factor=selectTotpFactor(data);if(!factor||factor.status!=='verified')throw Error('MFA_REQUIRED');const r=await client.auth.mfa.challengeAndVerify({factorId:factor.id,code});if(r.error)throw r.error;await retry();}
      catch{status.textContent=t('验证未完成，请核对当前代码。','Verification did not complete. Check the current code.');}finally{button.disabled=false;}});card.append(form);}
  const sign=el('a',t('前往现有GG登录','Go to existing GG sign-in'));sign.href='index.html?mode=login';const normal=el('a',t('返回正常预约','Return to normal booking'));normal.href='booking.html';const check=el('button',t('重新检查访问权限','Check access again'));check.type='button';check.onclick=()=>void retry();card.append(status,sign,normal,check);root.append(card);
}
