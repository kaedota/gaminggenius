import{renderTopup,topupActions}from'./wallet-topup.mjs?v=paid-only-v1';
import{connect}from'./api.js?v=20261116-notes';
import config from'./config.js';
import{mountMemberPanel,memberCall,memberText}from'./gg-member.mjs?v=paid-only-v1';
import{createMemberCall}from'./gg-member-payment/member-api.mjs?v=paid-only-v1';
let lang='zh';try{lang=localStorage.getItem('gg-language')==='en'?'en':'zh';}catch{}const t=(zh,en)=>lang==='zh'?zh:en;
document.documentElement.lang=lang==='zh'?'zh-Hans':'en';document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{localStorage.setItem('gg-language',b.dataset.lang);location.reload();});
for(const[id,text]of Object.entries({subtitle:t('手机验证会员资料 · 本GG账号的交易记录','Phone-verified membership · This GG account’s transactions'),back:t('预约游戏','Book a session'),centre:t('会员中心','Member centre')}))document.getElementById(id).textContent=text;
const root=document.getElementById('membership'),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let panel,active=true,account={transactions:[],topups_enabled:false},accountLoaded=false,accountError='',member=null,version=0,call,read;
function renderExtras(){
 const top=document.getElementById('topup');renderTopup(top,{data:{member,topups_enabled:false},t});
 const box=document.getElementById('transactions');box.replaceChildren(el('h2',t('本GG账号的线上交易记录','This GG account’s online transactions')),el('p',t('手机号验证不会显示其他GG账号的交易记录。','Phone verification does not display another GG account’s transaction history.')));
 if(accountError){box.append(el('p',accountError));return;}if(!accountLoaded){box.append(el('p',t('正在读取当前GG账号记录…','Reading this GG account’s records…')));return;}
 const rows=account.transactions||[];if(!rows.length){box.append(el('p',t('当前GG账号暂无线上的会员交易。','This GG account has no online membership transactions yet.')));return;}
 const table=el('table');for(const row of rows){const tr=el('tr');const chargedReview=row.state==='settled'&&row.kind!=='topup'&&(row.booking_confirmed===false||row.allocation_state==='paid_unallocated'||row.refund_state==='review'||!row.booking_id||row.booking_payment_status!=='paid'||!['confirmed','checked_in','completed'].includes(row.booking_status));
  const status=chargedReview?t('已扣款，预约需核对','Debited; booking needs review'):({prepared:t('建立中','Preparing'),due:t('待付款','Awaiting payment'),processing:t('处理中，勿重复付款','Processing; do not pay again'),settled:t('已完成','Completed'),failed:t('未完成','Not completed'),uncertain:t('待核对，勿重复付款','Review required; do not pay again')}[row.state]||row.state);
  for(const text of[row.id,new Date(row.created_at).toLocaleString(lang==='zh'?'zh-CN':'en-GB',{timeZone:'Asia/Kuala_Lumpur'}),({topup:t('充值','Top-up'),booking_balance:t('余额预约','Balance booking'),booking_points:t('积分预约','Points booking')}[row.kind]||row.kind),'RM '+(row.cents/100).toFixed(2),status])tr.append(el('td',text));
  const actions=el('td');topupActions(actions,{row,call,t,reload:loadAccount,active:()=>active});tr.append(actions);table.append(tr);
 }box.append(table);
}
async function loadAccount(){const current=++version;accountError='';try{const data=await read('member_tac_account',{});if(!active||current!==version)return;if(!Array.isArray(data.transactions)||data.topups_enabled!==false)throw Error('TAC_RESPONSE_INVALID');account={transactions:data.transactions,topups_enabled:false};accountLoaded=true;renderExtras();}
 catch(error){if(active&&current===version){accountError=memberText(t,error);renderExtras();}}}
try{const client=await connect({manualCallback:true});const{data,error}=await client.auth.getUser();if(error||!data?.user)throw Error('AUTH_REQUIRED');const identity=el('p',t('GG 登录账号：','GG signed-in account: ')+data.user.email);identity.className='gg-member-account';document.getElementById('subtitle').after(identity);
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&session.user.id!==data.user.id)){active=false;++version;member=null;account={transactions:[],topups_enabled:false};panel?.dispose();identity.remove();root.replaceChildren(el('p',t('账号已改变或会话已结束，请刷新页面。','The account changed or the session ended. Refresh this page.')));document.getElementById('topup').replaceChildren();document.getElementById('transactions').replaceChildren();}});
 call=memberCall(client);read=createMemberCall(client,config,{expectedUserId:data.user.id});panel=mountMemberPanel(root,{client,t,onChange:data=>{if(!active)return;member=data.member||null;renderExtras();}});renderExtras();await loadAccount();
 const returned=new URL(location.href).searchParams.get('topup');if(active&&/^[0-9a-f-]{36}$/i.test(returned||'')){try{await call('refresh_topup',{id:returned});if(active)await loadAccount();}catch(error){if(active){const note=el('p',memberText(t,error));note.setAttribute('role','status');document.getElementById('transactions').prepend(note);}}}
}catch(error){root.replaceChildren(el('p',memberText(t,error)));const sign=el('a',t('登录GG账号 →','Sign in to GG →'));sign.href='index.html?mode=login';root.append(sign);document.getElementById('topup').hidden=true;document.getElementById('transactions').hidden=true;}
window.addEventListener('pagehide',()=>{active=false;++version;member=null;panel?.dispose();document.getElementById('transactions').replaceChildren();});
