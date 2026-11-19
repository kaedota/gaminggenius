export function mountBookingMail(container,{rpc,t}) {
  const panel=document.createElement('section');panel.className='panel';
  panel.innerHTML='<h2>'+t('预约确认邮件','Booking confirmation emails')+'</h2><p>'+t('“服务器已接受”不代表顾客已读。结果不确定的邮件不会自动重发，避免重复通知。','SMTP accepted does not mean read or inbox delivery. Uncertain attempts are not resent automatically.')+'</p><button type="button" data-mail-refresh>'+t('刷新邮件状态','Refresh email status')+'</button><p data-mail-state role="status"></p><div data-mail-records></div>';
  container.append(panel);
  const state=panel.querySelector('[data-mail-state]'),records=panel.querySelector('[data-mail-records]');
  const labels={pending:t('待发送','Queued'),processing:t('发送中','Sending'),accepted:t('邮件服务器已接受','SMTP accepted'),failed:t('发送失败，可检查后重试','Failed; review before retry'),uncertain:t('结果不确定，请核实后人工处理','Uncertain; check before further action'),skipped:t('未发送（预约已变化或测试限制）','Not sent (booking changed or pilot restriction)')};
  let busy=false,lastDate;
  async function refresh(){
    if(busy||!container.isConnected)return;
    const date=container.querySelector('#booking-day')?.value;if(!date)return;
    busy=true;state.textContent=t('正在读取邮件记录…','Reading email records…');
    try {
      const rows=await rpc('gg_booking_email_status',{p_date:date});
      if(!container.isConnected||date!==container.querySelector('#booking-day')?.value)return;
      lastDate=date;records.replaceChildren();
      for(const row of rows){
        const card=document.createElement('article');card.className='hold-card';
        const id=document.createElement('p');id.textContent=row.booking_id;
        const label=document.createElement('strong');label.textContent=labels[row.state]||row.state;
        const detail=document.createElement('p');detail.textContent=t('尝试次数：','Attempts: ')+row.attempts+(row.error_code?' · '+row.error_code:'');
        card.append(id,label,detail);
        if(row.state==='failed'&&row.attempts<3){
          const form=document.createElement('form'),reason=document.createElement('input'),button=document.createElement('button');
          reason.required=true;reason.maxLength=500;reason.placeholder=t('简短说明，例如 ok','Short reason, e.g. ok');reason.setAttribute('aria-label',t('邮件重试原因','Email retry reason'));
          button.textContent=t('确认重试这封邮件','Confirm retry of this email');
          form.append(reason,button);form.onsubmit=async event=>{event.preventDefault();if(!reason.value.trim())return;button.disabled=true;try{await rpc('gg_booking_email_retry',{p_id:row.booking_id,p_reason:reason.value.trim()});await refresh();}catch{state.textContent=t('未完成重试，请刷新后核实。','Retry was not completed. Refresh and verify.');}finally{button.disabled=false;}};
          card.append(form);
        }
        records.append(card);
      }
      state.textContent=rows.length?t('此营业日的确认邮件记录','Confirmation emails for this business date'):t('此营业日暂无邮件记录；历史预约不会补发。','No email records for this business date. Historical bookings are not backfilled.');
    }catch{state.textContent=t('邮件服务尚未接通或会话已过期，请刷新后台。','Email service is not connected or the session expired. Refresh the admin page.');}
    finally{busy=false;}
  }
  panel.querySelector('[data-mail-refresh]').onclick=refresh;
  container.querySelector('#booking-day-form')?.addEventListener('submit',()=>void refresh());
  container.querySelector('#booking-day')?.addEventListener('change',()=>{if(lastDate!==container.querySelector('#booking-day')?.value)records.replaceChildren();void refresh();});
  const timer=setInterval(()=>{if(!container.isConnected){clearInterval(timer);return;}if(!document.hidden&&!panel.contains(document.activeElement))void refresh();},30000);
  void refresh();
}
