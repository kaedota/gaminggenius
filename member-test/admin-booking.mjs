import{mountSimulators}from'./simulator-local-controls.mjs?v=20261122-local-v1';
import {mountBookingMail} from './booking-email-status.mjs?v=20261119-mail';
import {enableOfficialFloor} from './gg-official-floor.mjs?v=20261121-cancel-entry-v2';
import {mountFloorAdmin} from './booking-live.mjs?v=20261118-floor';
export function mountBookings(container,{rpc,t,onFailure}){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const labels={confirmed:t('已确认','Confirmed'),checked_in:t('已签到','Checked in'),completed:t('已完成','Completed'),cancelled:t('已取消','Cancelled'),no_show:t('未到场','No show')};
 const actions={check_in:t('到店签到','Check in'),mark_paid:t('登记已收款','Record payment received'),complete:t('结束游玩','Complete session'),cancel:t('取消并释放机位','Cancel and release station'),no_show:t('标记未到场','Mark no show')};
 const targetBooking=new URLSearchParams(location.search).get('booking');const requestedDay=new URLSearchParams(location.search).get('booking_date');let selected=/^\d{4}-\d{2}-\d{2}$/.test(requestedDay||'')?requestedDay:today,loading=false,ticket=0;let targetShown=false;
 container.innerHTML=`<div id="hardware-operations"></div><div id="simulator-operations"></div><div id="floor-operations"></div><section class="panel"><div class="panel-head"><div><h2>${t('游戏预约 · 到店安排机位','Gaming bookings · Staff station assignment')}</h2><p>${t('马来西亚营业日 · 最多200笔；下方显示该日最近100条操作记录。','Malaysia business date · Up to 200 bookings and latest 100 actions for that day.')}</p></div><a href="booking.html">${t('打开预约页 ↗','Booking page ↗')}</a></div><form id="booking-day-form" class="toolbar"><label>${t('营业日','Business date')} <input id="booking-day" type="date" value="${selected}" required></label><button type="submit">${t('查询 / 刷新','Load / Refresh')}</button></form><p>${t('迟到15分钟后可标记未到场；不会自动释放。收款登记只记录店内实际收到的费用，不会向顾客扣款。员工可取消已付款预约并释放机位；原付款保留，退款须人工审核。换机位不会开关电视。','After 15 minutes, staff may mark a no-show. There is no automatic release. Recording payment logs money already received; it does not charge the customer. Staff may cancel paid bookings and release the station. Payment is retained for manual refund review. Assigning a station does not switch the TV.')}</p><p id="booking-admin-status" role="status"></p><div id="booking-admin-list"></div><details><summary>${t('预约操作记录','Booking activity')}</summary><div id="booking-admin-audit"></div></details></section>`;
 void enableOfficialFloor(container.querySelector('#hardware-operations'),{rpc,t,onManageBooking:manageFromStation}).catch(()=>{});
 mountSimulators(container.querySelector('#simulator-operations'),{rpc,t});
 mountFloorAdmin(container.querySelector('#floor-operations'),{rpc,t,onFailure});
 const list=container.querySelector('#booking-admin-list'),status=container.querySelector('#booking-admin-status');
 const dayForm=container.querySelector('#booking-day-form'), dayInput=container.querySelector('#booking-day');
 const audit=container.querySelector('#booking-admin-audit');
 function editing(){return list.contains(document.activeElement)||[...list.querySelectorAll('textarea,input[type=checkbox]')].some(field=>field.tagName==='TEXTAREA'?field.value.trim():field.checked);}
 const stamp=s=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(s));
 async function load({background=false}={}){
  if(loading||!container.isConnected)return;
  loading=true;
  const own=++ticket, requestDate=selected;
  if(!background)status.textContent=t('正在读取…','Loading…');
  try{const data=await rpc('gg_booking_admin_list',{p_date:requestDate});if(!container.isConnected||own!==ticket||requestDate!==selected||(background&&editing()))return;if(!Array.isArray(data?.records)||!Array.isArray(data.audit))throw Error('DATA_FORMAT_INVALID');
   status.textContent=t('已读取','Loaded')+' '+data.records.length+' / '+data.limit;
   list.innerHTML=data.records.map(h=>{const opts=[];const now=Date.now();if(h.status==='confirmed'&&(!['fpx','gg_member'].includes(h.payment_method)||h.payment_status==='paid')){if(now>=Date.parse(h.start_at)-1800000&&now<Date.parse(h.end_at))opts.push('check_in');if(h.payment_status==='unpaid'){opts.push('cancel');if(now>=Date.parse(h.start_at)+900000)opts.push('no_show');}}if(h.status==='checked_in'){if(h.payment_status==='unpaid')opts.push('mark_paid','cancel');else opts.push('complete');}if(['confirmed','checked_in'].includes(h.status)&&!(h.refund_status==='not_required'&&h.status==='confirmed')&&!opts.includes('cancel'))opts.push('cancel');return `<article class="hold-card" data-booking-id="${esc(h.id)}" data-booking-station="${esc(h.station_id)}" data-booking-start="${esc(h.start_at)}"><div><h3>${esc(h.station_id)} · ${esc(labels[h.status]||h.status)}</h3><p>${esc(stamp(h.start_at))} — ${esc(stamp(h.end_at))} · ${h.people}/4</p><p>${esc(h.member_email)} · RM${(h.cents/100).toFixed(2)} · ${h.payment_method==='fpx'?'FPX · ':h.payment_method==='gg_member'?'GG Member · ':''}${h.payment_status==='paid'?t('已收款','Paid'):t('未收款','Unpaid')}</p>${/^\+[1-9][0-9]{7,14}$/.test(h.contact_phone??'')?`<p>${t('联系电话','Contact phone')} · <a href="tel:${esc(h.contact_phone)}">${esc(h.contact_phone)}</a></p>`:''}<small>${esc(h.id)}</small>${h.refund_status==='not_required'&&h.status==='confirmed'?'<p>'+t('取消处理中：等待支付平台关闭账单，关闭后才释放名额。','Cancellation processing: capacity releases after the payment provider closes the bill.')+'</p>':''}${h.refund_status==='review_required'?'<p>'+t('已取消 · 已收款，待人工退款审核','Cancelled · Paid; manual refund review required')+'</p>':''}${['confirmed','checked_in'].includes(h.status)&&(!['fpx','gg_member'].includes(h.payment_method)||h.payment_status==='paid')?`<form class="booking-assign" data-id="${esc(h.id)}" data-version="${h.version}"><label>${t('安排／更换机位','Assign / change station')} <select name="station">${[1,2,3].map(n=>{const id=h.station_id.split('-')[0]+'-'+n;return '<option value="'+id+'" '+(id===h.station_id?'selected':'')+'>'+id+'</option>';}).join('')}</select></label><label>${t('说明','Reason')}<textarea name="reason" minlength="1" maxlength="500" required></textarea></label><button type="submit">${t('保存机位安排','Save assignment')}</button><p role="status"></p></form>`:''}${opts.length?`<form class="booking-action" data-id="${esc(h.id)}" data-version="${h.version}"><label>${t('操作','Action')} <select name="action">${opts.map(a=>`<option value="${a}">${actions[a]}</option>`).join('')}</select></label><label>${t('处理说明（1–500字）','Reason (1–500 characters)')}<textarea name="reason" minlength="1" maxlength="500" required></textarea></label><label><input type="checkbox" required> ${t('已核对真实情况；收款操作仅在实际收到款项后使用。','I verified the facts; payment is recorded only after receiving the money.')}</label><button type="submit">${t('确认保存操作','Confirm action')}</button><p role="status"></p></form>`:''}</div></article>`;}).join('')||`<p>${t('该营业日没有预约。','No bookings for this business date.')}</p>`;
   list.querySelectorAll('form.booking-assign').forEach(form=>form.onsubmit=async ev=>{ev.preventDefault();if(loading)return;loading=true;const b=form.querySelector('button'),msg=form.querySelector('[role=status]');b.disabled=true;try{await rpc('gg_booking_admin_assign',{p_id:form.dataset.id,p_station:form.elements.station.value,p_version:Number(form.dataset.version),p_reason:form.elements.reason.value});loading=false;await load();}catch(err){msg.textContent=t('未完成：机位可能被占用或记录已更新，请刷新核对。','Not completed: station may be occupied or record changed. Refresh and check.');await onFailure(err);}finally{loading=false;if(b.isConnected)b.disabled=false;}});
   if(!targetShown&&/^[0-9a-f-]{36}$/i.test(targetBooking||'')){const target=[...list.querySelectorAll('[data-booking-id]')].find(n=>n.dataset.bookingId===targetBooking);if(target){target.classList.add('gg-ops-target');target.scrollIntoView({block:'center'});targetShown=true;}}
   audit.innerHTML=data.audit.map(a=>`<p>${esc(stamp(a.created_at))} · ${esc(a.action)} · ${esc(a.target)} · ${esc(a.actor)} ${esc(a.detail?.reason||'')}</p>`).join('')||t('暂无操作记录。','No activity.');
   list.querySelectorAll('form.booking-action').forEach(form=>form.onsubmit=async ev=>{ev.preventDefault();if(loading)return;loading=true;const b=form.querySelector('button'),msg=form.querySelector('[role=status]');b.disabled=true;let saved=false;try{await rpc('gg_booking_admin_action',{p_id:form.dataset.id,p_action:form.elements.action.value,p_version:Number(form.dataset.version),p_reason:form.elements.reason.value});saved=true;loading=false;await load();}catch(err){if(!container.isConnected)return;msg.textContent=saved?t('已写入但刷新失败，请查询核对，不要重复操作。','Saved but refresh failed. Reload to verify before retrying.'):t('操作未完成，请刷新资料后核对状态。','Action not completed. Refresh and verify the state.');await onFailure(err);}finally{loading=false;if(b.isConnected)b.disabled=false;}});
  }catch(err){if(container.isConnected){status.textContent=t('读取失败，不代表没有预约。','Loading failed; this does not mean there are no bookings.');await onFailure(err);}}finally{loading=false;if(container.isConnected&&requestDate!==selected)void load();}}
 async function manageFromStation(station,start){
  let day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start));
  if(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',hourCycle:'h23'}).format(new Date(start))==='00'){const d=new Date(day+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()-1);day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  if(selected!==day){selected=day;dayInput.value=day;await load();}
  const row=[...list.querySelectorAll('[data-booking-id]')].find(n=>n.dataset.bookingStation===station&&Date.parse(n.dataset.bookingStart)===Date.parse(start));
  if(!row){status.textContent=t('请在下方按营业日查询对应预约。','Find this booking below by business date.');dayForm.scrollIntoView({block:'center'});return;}
  row.scrollIntoView({block:'center',behavior:'smooth'});
  row.classList.add('gg-ops-target');
  const form=row.querySelector('form.booking-action');
  if(form&&[...form.elements.action.options].some(o=>o.value==='cancel')){form.elements.action.value='cancel';form.querySelector('button').textContent=t('确认取消并释放机位','Confirm cancellation and release');form.querySelector('[role=status]').textContent=t('填写说明并勾选确认后，再按取消按钮。','Enter a reason and tick confirmation before cancelling.');form.elements.reason.focus({preventScroll:true});}
 }
 function selectDate(){
  if(!dayInput.value)return;
  if(selected!==dayInput.value){selected=dayInput.value;list.replaceChildren();audit.replaceChildren();}
  void load();
 }
 dayForm.onsubmit=ev=>{ev.preventDefault();selectDate();};
 dayInput.addEventListener('change',selectDate);
 function refreshInBackground(){
  if(!container.isConnected){
   clearInterval(timer);
   document.removeEventListener('visibilitychange',refreshInBackground);
   return;
  }
  if(!document.hidden&&!editing()&&document.activeElement!==dayInput)void load({background:true});
 }
 const timer=setInterval(refreshInBackground,15000);
 document.addEventListener('visibilitychange',refreshInBackground);
 mountBookingMail(container,{rpc,t});
 void load();
}
