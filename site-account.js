import {connect,rpc} from './member-test/api.js?v=20261115-account';
import {mountAccount} from './account-control.js?v=20261128-simple-v1';
const root=document.getElementById('site-account');
export const accountClient=root?connect({manualCallback:true}):Promise.resolve(null);
if(root) {
  try {
    const client=await accountClient;
    mountAccount(root,client.auth,()=>rpc('gg_session'),'member-test/index.html');
  } catch {
    // Existing login/register links remain available when account service is offline.
  }
}

