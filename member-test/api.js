import {createAuthStorage} from "./auth-storage.js";
import config from "./config.js";
let client;
export function publicKeyOnly(key) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(
        atob(key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
      ).role === "anon"
    );
  } catch {
    return false;
  }
}

export async function connect() {
  if (!config.enabled || !config.supabaseUrl || !config.publishableKey)
    throw Error("CONFIG_MISSING");
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl) ||
    !publicKeyOnly(config.publishableKey)
  )
    throw Error("INVALID_PUBLIC_CONFIG");
  const { createClient } = await import("./vendor/supabase.js");
  client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      flowType: "pkce",
      storage: createAuthStorage(sessionStorage,localStorage),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
export function safeError(error) {
  const m = error?.message || "";
  if (/Error sending (recovery|confirmation|invite|magic link) email/i.test(m)) return "验证邮件暂时无法发出，GG 发信服务需要检查。请联系 GG，不用重复注册。";
  const providerErrors = {
    mfa_verification_failed: "验证码不匹配。请使用当前的6位验证码；若持续失败，请重新绑定验证器并完整复制新密钥。",
    mfa_challenge_expired: "验证请求已过期，请输入验证器的新验证码后重试。",
    mfa_verification_rejected: "验证码尝试过于频繁，请稍后重试。",
    over_request_rate_limit: "请求过于频繁，请稍后再试。",
    mfa_factor_not_found: "验证器绑定已变化，请刷新本页后重试。",
    mfa_factor_name_conflict: "已有待确认的验证器，请直接验证，或使用重新绑定按钮。",
    mfa_ip_address_mismatch: "验证期间网络地址发生变化，请保持同一网络后重新登录。",
  };
  if (providerErrors[error?.code]) return providerErrors[error.code];
  const known = [
    "AUTH_REQUIRED",
    "EMAIL_VERIFICATION_REQUIRED",
    "PILOT_CLOSED",
    "ADMIN_REQUIRED",
    "MFA_REQUIRED",
    "RATE_LIMITED",
    "CLAIM_ALREADY_REVIEWED",
    "PLAYER_ALREADY_BOUND",
    "PLAYER_NOT_AVAILABLE",
    "NOT_YOUR_PLAYER",
    "CONFIG_MISSING",
    "CAPTCHA_REQUIRED",
  ];
  const code = known.find((k) => m.includes(k));
  return (
    {
      AUTH_REQUIRED: "会话已过期，请重新登录。",
      EMAIL_VERIFICATION_REQUIRED: "请先验证邮箱。",
      PILOT_CLOSED: "账号身份已验证，但测试访问尚未开通。请联系 GG，无需重复注册。",
      ADMIN_REQUIRED: "此操作仅限授权管理员。",
      MFA_REQUIRED: "请先完成管理员双重验证。",
      RATE_LIMITED: "操作过于频繁，请稍后重试。",
      CLAIM_ALREADY_REVIEWED: "这份申请已处理，请刷新列表。",
      PLAYER_ALREADY_BOUND: "该档案已绑定，不能重复批准。",
      PLAYER_NOT_AVAILABLE: "无法提交这份档案的申请，请联系 GG。",
      NOT_YOUR_PLAYER: "你没有权限管理这份档案。",
      CONFIG_MISSING: "账号功能尚未连接测试身份服务。",
      CAPTCHA_REQUIRED: "请先完成登录保护验证。",
    }[code] ||
    "操作未完成。请检查输入或网络后重试；登录失败时请确认邮箱已验证。"
  );
}
export async function rpc(name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}
export async function verified() {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw Error("AUTH_REQUIRED");
  return data.user;
}
