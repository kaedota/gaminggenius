export function accountName(user) {
  const m = user?.user_metadata || {};
  const name = [m.full_name, m.name, m.display_name].find(v => typeof v === 'string' && v.trim());
  return (name?.trim() || user?.email?.split('@')[0] || 'GG 会员').slice(0, 60);
}

export function createAccountState(auth, access, render) {
  let generation = 0, leaving = false;
  async function refresh() {
    const current = ++generation;
    try {
      const session = await auth.getSession();
      if (session.error) throw session.error;
      if (!session.data.session) {
        if (current === generation) render({kind:'guest'});
        return;
      }
      const result = await auth.getUser();
      if (result.error) throw result.error;
      if (!result.data.user) throw Error('AUTH_REQUIRED');
      await access();
      if (current === generation) render({kind:'member',name:accountName(result.data.user)});
    } catch {
      if (current === generation) render({kind:'unavailable'});
    }
  }
  async function logout() {
    if (leaving) return;
    leaving = true;
    ++generation;
    render({kind:'leaving'});
    try {
      const {error} = await auth.signOut({scope:'local'});
      if (error) throw error;
      ++generation;
      render({kind:'guest'});
    } catch {
      ++generation;
      render({kind:'unavailable',message:'退出未完成，请重试。'});
    } finally { leaving = false; }
  }
  return {refresh,logout};
}
