import{memberText}from'./gg-member.mjs?v=paid-only-v1';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function renderTopup(root,{data,t}){

 root.replaceChildren(el('h2',t('会员充值奖励','Member top-up rewards')));
 root.append(el('p',t('首次开通储值会员须充值 RM100，赠送 RM20，总到账 RM120。已开通会员可选择 RM50 起的充值档位。','Activate a stored-value membership with RM100 and receive RM20 extra: RM120 total. Existing members can top up from RM50.')));
 const table=el('table'),caption=el('caption',t('充值奖励表','Top-up rewards'));
 table.append(caption);
 const head=el('thead'),heading=el('tr');
 for(const label of[t('实付充值','You pay'),t('赠送余额','Bonus'),t('总到账','Total credit')]){const th=el('th',label);th.scope='col';heading.append(th);}head.append(heading);table.append(head);
 const body=el('tbody');
 for(const [paid,bonus] of [[50,5],[100,20],[300,70],[500,150],[1000,350]]){const row=el('tr');for(const amount of[paid,bonus,paid+bonus])row.append(el('td','RM '+amount.toFixed(2)));body.append(row);}table.append(body);root.append(table);
 const note=el('p',t('线上充值奖励暂未开放。请到店充值，完成后重新验证手机号，读取最新余额。','Online bonus top-ups are not open yet. Top up in store, then verify your phone again for a new balance snapshot.'));
 note.className='gg-member-warning';root.append(note);
}
export function topupActions(root,{row,call,t,reload,active}){if(row.kind!=='topup'||row.state!=='due')return;if(/^https:\/\/www\.billplz\.com\/bills\/[A-Za-z0-9_-]+$/.test(row.bill_url||'')){const pay=el('a',t('继续付款','Continue payment'));pay.href=row.bill_url;root.append(pay);}const refresh=el('button',t('核对付款／入账','Check payment / credit'));refresh.type='button';refresh.onclick=async()=>{refresh.disabled=true;try{await call('refresh_topup',{id:row.id});if(active())await reload();}catch(error){if(active())refresh.textContent=memberText(t,error);}};root.append(refresh);}
