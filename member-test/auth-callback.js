// Exchange explicitly: the bundled SDK auto callback discards redirectType.
// Only a successful server exchange can identify a recovery session.
export async function exchangeEmailCallback(auth, href) {
  const code = new URL(href).searchParams.get('code');
  if (!code) return null;
  const { data, error } = await auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data?.session?.user?.id) throw Error('AUTH_REQUIRED');
  return {session:data.session,recovery:data.redirectType === 'PASSWORD_RECOVERY'};
}

export function readRecoveryToken(href) {
  const token = new URLSearchParams(new URL(href).hash.slice(1)).get('recovery_token');
  if (token === null) return null;
  if (!/^[A-Za-z0-9_-]{20,512}$/.test(token)) throw Error('RECOVERY_LINK_INVALID');
  return token;
}

export async function verifyRecoveryToken(auth, token) {
  if (!token) throw Error('RECOVERY_LINK_INVALID');
  const {data,error}=await auth.verifyOtp({token_hash:token,type:'recovery'});
  if (error) throw error;
  if (!data?.session?.user?.id) throw Error('AUTH_REQUIRED');
  return data.session;
}
