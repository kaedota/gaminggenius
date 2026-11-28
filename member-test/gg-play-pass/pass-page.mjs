import{connect}from'../api.js?v=20261116-notes';
import{createPassApi}from'./pass-paid-api.mjs?v=paid-only-v1';
import{createPassHttpBridge}from'./pass-paid-http.mjs?v=paid-only-v1';
import config from'../config.js';
import{createPassController}from'./pass-paid-controller.mjs?v=paid-only-v1';
import{mountPassPage}from'./pass-paid-app.mjs?v=paid-only-v1';
const root=document.getElementById('app');let view,controller,client,subscription,active=true,language='zh';try{language=localStorage.getItem('gg-language')==='en'?'en':'zh';}catch{}
const languageChanged=value=>{try{localStorage.setItem('gg-language',value);}catch{}};
try{client=await connect({manualCallback:true});const{data,error}=await client.auth.getUser();if(error||!data?.user)throw Error('AUTH_REQUIRED');const user=data.user;const sessionCheck=await client.rpc('gg_session');if(sessionCheck.error)throw sessionCheck.error;
 // The connected server retains all sales/SMS/device gates closed until acceptance.
 const bridge=createPassHttpBridge({client,config,expectedUserId:user.id});
 const api=createPassApi({...bridge,expectedUserId:user.id,getUserId:async()=>{const r=await client.auth.getSession();return r.error?null:r.data?.session?.user?.id||null;}});
 let store;try{store=sessionStorage;}catch{store=null;}
 controller=createPassController({api,userId:user.id,store,onChange:state=>view?.update(state)});
 view=mountPassPage(root,{controller,user,language,onLanguage:languageChanged});
 subscription=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||session?.user?.id&&session.user.id!==user.id)controller.authChanged();})?.data?.subscription;
 await controller.boot();
}catch{if(active)view=mountPassPage(root,{language,onLanguage:languageChanged});}
window.addEventListener('pagehide',()=>{active=false;controller?.dispose();view?.dispose();subscription?.unsubscribe();});
