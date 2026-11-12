// Use the existing Supabase PKCE client; no Google tokens are stored by the UI.
export async function googleEnabled(config, fetcher = fetch) {
  try {
    const response = await fetcher(`${config.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: config.publishableKey }, cache: "no-store",
    });
    return response.ok && (await response.json()).external?.google === true;
  } catch { return false; }
}

export async function googleSignInUrl(auth, config, href) {
  const redirect = new URL(href);
  redirect.search = "";
  redirect.hash = "";
  const { data, error } = await auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirect.href,
      skipBrowserRedirect: true,
      scopes: "openid email profile",
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  const target = new URL(data?.url || "https://invalid.invalid");
  if (target.origin !== new URL(config.supabaseUrl).origin ||
      target.pathname !== "/auth/v1/authorize" ||
      target.searchParams.get("provider") !== "google") throw Error("OAUTH_URL_INVALID");
  return target.href;
}
