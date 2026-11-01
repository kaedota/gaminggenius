// Share only the short-lived PKCE verifier across tabs so email callbacks work.
// Login/refresh tokens remain in sessionStorage, never in localStorage.
export function createAuthStorage(tabStorage,sharedStorage,now=()=>Date.now()){
 const prefix='gg-pkce:';
 const isVerifier=key=>key.endsWith('-code-verifier');
 return {
  getItem(key){
   if(!isVerifier(key))return tabStorage.getItem(key);
   const stored=sharedStorage.getItem(prefix+key);
   if(stored!==null){try{const item=JSON.parse(stored);if(typeof item.value==='string'&&item.expiresAt>now())return item.value;}catch{}sharedStorage.removeItem(prefix+key);return null;}
   return tabStorage.getItem(key); // Compatibility with a flow started in this tab before upgrade.
  },
  setItem(key,value){
   if(isVerifier(key)){sharedStorage.setItem(prefix+key,JSON.stringify({value,expiresAt:now()+60*60*1000}));tabStorage.removeItem(key);}
   else tabStorage.setItem(key,value);
  },
  removeItem(key){tabStorage.removeItem(key);if(isVerifier(key))sharedStorage.removeItem(prefix+key);},
 };
}
