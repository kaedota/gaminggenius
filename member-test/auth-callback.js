// Exchange explicitly: the bundled SDK auto callback discards redirectType.
// Only a successful server exchange can identify a recovery session.
export async function exchangeEmailCallback(auth, href) {
  const code = new URL(href).searchParams.get('code');
  if (!code) return null;
  const { data, error } = await auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data?.session?.user?.id) throw Error('AUTH_REQUIRED');
  return {session:data.session,recovery:data.redirectType === 'recovery'};
}
