import {createAccountState} from './account-state.mjs?v=20261115';

export function mountAccount(root, auth, access, memberUrl) {
  const element=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const link=(text,mode)=>{const e=element('a',text);const url=new URL(memberUrl,location.href);if(mode)url.searchParams.set('mode',mode);e.href=url.href;return e;};
  let previous;
  const state=createAccountState(auth,access,value=>{
    // Keep keyboard focus and an opened account menu stable during token refresh.
    const signature=JSON.stringify(value);
    if(previous===signature)return;
    previous=signature;
    root.replaceChildren();
    if(value.kind==='guest') {
      const row=element('div');row.className='account-guest';
      row.append(link('会员中心'));
      root.append(row);return;
    }
    if(value.kind==='member') {
      const menu=element('details');menu.className='account-dropdown';
      const summary=element('summary','已登录 · '+value.name);summary.title='已登录 · '+value.name;
      const panel=element('div');panel.className='account-menu';
      const logout=element('button','退出登录');logout.type='button';logout.onclick=()=>void state.logout();
      panel.append(link('会员中心'),logout);menu.append(summary,panel);root.append(menu);return;
    }
    if(value.kind==='leaving') {
      const pending=element('button','正在退出…');pending.disabled=true;root.append(pending);return;
    }
    root.append(link('查看账号'));
    const message=element('span',value.message||'账号状态暂时无法确认');message.className='account-status';message.role='status';root.append(message);
  });
  const subscription=auth.onAuthStateChange(()=>setTimeout(()=>void state.refresh(),0));
  const onFocus=()=>void state.refresh();window.addEventListener('focus',onFocus);
  const onVisible=()=>{if(document.visibilityState==='visible')void state.refresh();};document.addEventListener('visibilitychange',onVisible);
  void state.refresh();
  return ()=>{subscription.data.subscription.unsubscribe();window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible);};
}

