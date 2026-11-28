import{createMemberCall,permitsPurpose}from'./member-api.mjs?v=paid-only-v1';
import{mountMemberCheckout}from'./member-checkout.mjs?v=paid-only-v1';
import{hasMemberRecovery,hasFinancialRecovery}from'./member-controller.mjs?v=paid-only-v1';
const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
export function mountMemberWidget(root,{client,config,t,context={purpose:'lookup'},onChange=()=>{},onSettled=()=>{},onBusyChange=()=>{},onFinancialLock=()=>{},onUseFpx}){
 let panel,disposed=false,epoch=0,subscription,activeUserId,store;try{store=sessionStorage;}catch{store=null;}
 if(!document.querySelector('[data-member-tac-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./member-checkout.css?v=paid-only-v1',import.meta.url).href;link.dataset.memberTacStyle='';document.head.append(link);}
 async function load(){const version=++epoch;panel?.dispose();panel=null;onBusyChange(true);root.replaceChildren(node('p',t('正在检查手机会员服务…','Checking phone-verified membership service…')));
  try{const{data,error}=await client.auth.getUser();if(error||!data?.user)throw Error('AUTH_REQUIRED');const user=data.user;activeUserId=user.id;const call=createMemberCall(client,config,{expectedUserId:user.id}),access=await call('member_tac_access',{});if(disposed||version!==epoch)return;
   const allowed=permitsPurpose(access,context.purpose),retained=hasMemberRecovery(store,user.id,context.purpose);
   panel=mountMemberCheckout(root,{call,context,userId:user.id,userEmail:user.email||'',enabled:allowed||retained,readOnly:!allowed,store,language:t('zh','en'),onSettled,onBusyChange,onFinancialLock,onUseFpx,onLookup:member=>onChange({member,lookup_only:true})});
   onChange({member:null,lookup_only:context.purpose==='lookup',access});
  }catch(error){if(disposed||version!==epoch)return;const locked=context.purpose!=='lookup'&&!!activeUserId&&hasFinancialRecovery(store,activeUserId);onFinancialLock(locked);root.replaceChildren(node('h3','GG MEMBER'),node('p',locked?t('原会员付款待核对，请勿再次付款。','The original member payment needs review. Do not pay again.'):error?.message==='AUTH_REQUIRED'?t('请先登录GG账号。','Sign in to GG first.'):t('手机会员服务暂时无法读取；不会发短信或扣款。','The membership service is unavailable. No SMS or debit is started.')));if(onUseFpx&&!locked){const button=node('button',t('选择FPX付款','Choose FPX'));button.type='button';button.onclick=onUseFpx;root.append(button);}}
  finally{if(!disposed&&version===epoch)onBusyChange(false);}
 }
 const auth=client.auth.onAuthStateChange?.((event,session)=>{const changed=!!activeUserId&&!!session?.user?.id&&session.user.id!==activeUserId;if(event==='SIGNED_OUT'||changed){++epoch;panel?.signOut();panel?.dispose();panel=null;root.replaceChildren(node('p',t('登录账号已改变或会话已结束，请刷新页面。','The signed-in account changed or the session ended. Refresh this page.')));onChange({member:null,lookup_only:true});}});subscription=auth?.data?.subscription;
 void load();return{get status(){return panel?.status;},reload:()=>panel?panel.reload():load(),setContext:value=>{context=value;panel?.setContext(value);},dispose(){disposed=true;++epoch;panel?.dispose();root.replaceChildren();subscription?.unsubscribe();onBusyChange(false);}};
}
