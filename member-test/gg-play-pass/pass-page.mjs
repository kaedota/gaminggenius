import{connect}from'../api.js?v=20261116-notes';
import{createPassApi}from'./pass-paid-api.mjs?v=paid-only-v1';
import{createPassHttpBridge}from'./pass-paid-http.mjs?v=paid-only-v1';
import config from'../config.js';
import{createPassController}from'./pass-paid-controller.mjs?v=paid-only-v1';
import{mountPassPage}from'./pass-paid-app.mjs?v=gta-guest-live-v1';
import{safeCatalog}from'./pass-paid-model.mjs?v=paid-only-v1';
export async function loadPublicPassCatalog({fetchImpl=fetch}={}){const response=await fetchImpl(config.supabaseUrl+'/functions/v1/gg-passes',{method:'POST',cache:'no-store',redirect:'error',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'gta_pass_catalog'}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error('PASS_SERVICE_UNAVAILABLE');return safeCatalog(data);}
const root=document.getElementById('app');let view,controller,client,subscription,active=true,language='zh';try{language=localStorage.getItem('gg-language')==='en'?'en':'zh';}catch{}
const languageChanged=value=>{try{localStorage.setItem('gg-language',value);}catch{}};
try{client=await connect({manualCallback:true});const{data,error}=await client.auth.getUser();if(error||!data?.user)throw Error('AUTH_REQUIRED');const user=data.user;const sessionCheck=await client.rpc('gg_session');if(sessionCheck.error)throw sessionCheck.error;
 // Signed-in customers retain the existing authenticated controller and financial flow.
 const bridge=createPassHttpBridge({client,config,expectedUserId:user.id});
 const api=createPassApi({...bridge,expectedUserId:user.id,getUserId:async()=>{const r=await client.auth.getSession();return r.error?null:r.data?.session?.user?.id||null;}});
 let store;try{store=sessionStorage;}catch{store=null;}
 controller=createPassController({api,userId:user.id,store,onChange:state=>view?.update(state)});
 view=mountPassPage(root,{controller,user,language,onLanguage:languageChanged});
 subscription=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||session?.user?.id&&session.user.id!==user.id)controller.authChanged();})?.data?.subscription;
 await controller.boot();
}catch{controller?.dispose();subscription?.unsubscribe();view?.dispose();if(active){let publicCatalog=null,publicCatalogUnavailable=false;try{publicCatalog=await loadPublicPassCatalog();}catch{publicCatalogUnavailable=true;}if(active)view=mountPassPage(root,{language,onLanguage:languageChanged,publicCatalog,publicCatalogUnavailable});}}
window.addEventListener('pagehide',()=>{active=false;controller?.dispose();view?.dispose();subscription?.unsubscribe();});
