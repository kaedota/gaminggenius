// Keep a pending enrollment across page focus/reload; never store its secret here.
export function selectTotpFactor(factors,currentId){
 const all=factors?.all||[...(factors?.totp||[])];
 const totp=all.filter(f=>f.factor_type==='totp'||(factors?.totp||[]).some(t=>t.id===f.id));
 const current=totp.find(f=>f.id===currentId);if(current)return current;
 const verified=totp.filter(f=>f.status==='verified');if(verified.length===1)return verified[0];
 if(verified.length>1)throw Error('MFA_FACTOR_SELECTION_REQUIRED');
 const pending=totp.filter(f=>f.status==='unverified');if(pending.length===1)return pending[0];
 if(pending.length>1)throw Error('MFA_FACTOR_SELECTION_REQUIRED');return null;
}
export function requiresLogin(error){return /AUTH_REQUIRED|JWT|expired|PILOT_CLOSED|ADMIN_REQUIRED|EMAIL_VERIFICATION_REQUIRED|permission denied/.test(error?.message||'')&&!/MFA_REQUIRED/.test(error?.message||'');}

// User-triggered setup restart may remove ONLY the exact unverified enrollment.
export async function removePendingTotp(client,id){
 const {data,error}=await client.auth.mfa.listFactors();if(error)throw error;
 const factor=(data.all||[]).find(f=>f.id===id&&f.factor_type==='totp');
 if(!factor||factor.status!=='unverified')throw Error('MFA_VERIFIED_FACTOR_PROTECTED');
 const result=await client.auth.mfa.unenroll({factorId:id});if(result.error)throw result.error;
}
