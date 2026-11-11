import {selectTotpFactor,requiresLogin,removePendingTotp} from "./mfa-state.js";
import config from "./config.js";
import { connect, rpc, verified, safeError } from "./api.js";
import { $, node, playerCard, jsonPanel } from "./ui.js";
import { publicPlayerDirectory, searchPublicPlayers } from "./model.js?v=20261111-directory";
let directory = [], selectedPlayer;
let captchaToken, widgetId;
let client,
  bundle,
  mode = "login",
  busy = false,
  factorId,
  role,
  booted = false;
const status = (text, error = false) => {
  $("status").textContent = text;
  $("status").className = error ? "notice status-error" : "notice";
};
const hidePrivate = () => {
  for (const id of ["account", "admin", "mfa", "owner"]) $(id).hidden = true;
  for (const id of [
    "players",
    "claims",
    "admin-queue",
    "admin-players",
    "audit",
  ])
    $(id).replaceChildren();
  $("feedback-player").replaceChildren();
  $("mfa-setup").replaceChildren();
  factorId = null;
  role = null;
};
async function perform(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("form:not(#directory-form) button").forEach((b) => (b.disabled = true));
  status("正在处理…");
  try {
    await fn();
  } catch (e) {
    status(safeError(e), true);
    if ((e.message || "").includes("MFA_REQUIRED")) {
      $("admin").hidden = true;
      $("owner").hidden = true;
      $("admin-players").replaceChildren();
      $("admin-queue").replaceChildren();
      $("audit").replaceChildren();
      $("auth").hidden = true;
      $("mfa").hidden = false;
    } else if (requiresLogin(e)) {
      hidePrivate();
      $("auth").hidden = false;
    }
  } finally {
    busy = false;
    document
      .querySelectorAll("form:not(#directory-form) button")
      .forEach((b) => (b.disabled = !client));
  }
}
function authMode(m) {
  mode = m;
  $("auth-title").textContent = {
    login: "登录",
    signup: "注册并验证邮箱",
    recover: "找回账号",
  }[m];
  $("submit").textContent = {
    login: "登录 →",
    signup: "注册 →",
    recover: "发送找回邮件 →",
  }[m];
  $("password-label").hidden = m === "recover";
  $("password").required = m !== "recover";
  $("password").autocomplete =
    m === "signup" ? "new-password" : "current-password";
}

function renderDirectory() {
  const query = $("directory-query").value;
  const matches = searchPublicPlayers(directory, query);
  $("directory-results").replaceChildren();
  $("directory-status").textContent = !query.trim()
    ? "输入比赛名字，查找已公布的积分记录。"
    : matches.length
      ? `找到 ${matches.length} 个档案。请核对后选择。`
      : "没有找到该名字。可以换用其他比赛名字或 GG ID 查找。";
  for (const player of matches) {
    const row = node("article", "", "directory-row");
    const info = node("div");
    info.append(
      node("h3", player.display_name),
      node("p", `${player.player_id} · ${player.season_name} · ${player.total} 分`),
    );
    const view = node("details");
    view.append(node("summary", "核对比赛记录"), playerCard(player, bundle));
    const select = node("button", "选择这个档案", "secondary");
    select.type = "button";
    select.onclick = () => {
      selectedPlayer = player;
      $("claim-id").value = player.player_id;
      $("selected-player").hidden = false;
      $("selected-player").textContent = `已选择 ${player.display_name}（${player.player_id}）。登录后填写核对说明并提交认领。`;
      const target = $("account").hidden ? $("auth") : $("claim-form");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      (target === $("auth") ? $("email") : $("claim-evidence")).focus();
    };
    row.append(info, view, select);
    $("directory-results").append(row);
  }
}
$("directory-form").onsubmit = (event) => {
  event.preventDefault();
  renderDirectory();
};
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => (b.onclick = () => authMode(b.dataset.mode)));
async function loadAccount() {
  await verified();
  const s = await rpc("gg_session");
  role = s.role;
  const data = await rpc("gg_dashboard");
  $("auth").hidden = true;
  $("account").hidden = false;
  if (selectedPlayer) {
    $("selected-player").textContent = `已选择 ${selectedPlayer.display_name}（${selectedPlayer.player_id}）。请填写参赛核对说明，提交后由 GG 审核。`;
  }
  $("players").replaceChildren(
    ...data.players.map((p) => playerCard(p, bundle)),
  );
  for (const p of data.players) {
    const mine = {
      results: data.records.filter((r) => r.player_id === p.player_id),
      slots: data.slots.filter((r) => r.player_id === p.player_id),
    };
    $("players").append(jsonPanel("已关联原始记录 · " + p.player_id, mine));
  }
  if (!data.players.length)
    $("players").append(
      node(
        "p",
        "尚未绑定选手档案。可申请认领，也可为未有记录的新选手建立档案。",
      ),
    );
  $("feedback-player").replaceChildren(
    ...data.players.map((p) => {
      const o = node("option", p.display_name + " · " + p.player_id);
      o.value = p.player_id;
      return o;
    }),
  );
  $("claims").replaceChildren(node("h3", "认领状态"));
  for (const c of data.claims)
    $("claims").append(
      node(
        "p",
        c.player_id +
          " · " +
          { pending: "待审核", approved: "已批准", rejected: "已拒绝" }[
            c.status
          ] +
          (c.reason ? " · " + c.reason : ""),
      ),
    );
  if (!data.claims.length) $("claims").append(node("p", "尚无认领申请。"));
  if (["owner", "admin"].includes(role)) {
    const { data: levels, error } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (levels.currentLevel !== "aal2") {
      $("mfa").hidden = false;
      const { data: factors, error: factorError } =
        await client.auth.mfa.listFactors();
      if (factorError) throw factorError;
      const factor = selectTotpFactor(factors, factorId);
      factorId = factor?.id;
      $("enroll").hidden = !!factorId;
      $("reset-mfa").hidden = factor?.status !== "unverified";
      if (factor?.status === "unverified") {
        status("验证器等待确认。请填写 KeePassXC 当前的 6 位验证码，无需重新设置。");
      }
    } else await loadAdmin();
  }
  if ($("mfa").hidden) status("已连接指定测试账号。");
}
async function loadAdmin() {
  await verified();
  const [players, q, audit] = await Promise.all([
    rpc("gg_admin_search", { p_query: $("admin-query").value }),
    rpc("gg_admin_queue"),
    rpc("gg_admin_audit"),
  ]);
  $("admin").hidden = false;
  $("mfa").hidden = true;
  $("owner").hidden = role !== "owner";
  $("admin-players").replaceChildren();
  for (const p of players) {
    const card = playerCard(p, bundle);
    card.append(node("p", p.managing_account ? "已绑定管理账号" : "尚未绑定"));
    const rename = node("form");
    rename.append(node("h3", "更正显示名字（永久 ID 保留）"));
    const name = node("input");
    name.value = p.display_name;
    name.maxLength = 80;
    name.required = true;
    name.setAttribute("aria-label", "新名字 " + p.player_id);
    const reason = node("textarea");
    reason.minLength = 10;
    reason.maxLength = 500;
    reason.required = true;
    reason.setAttribute("aria-label", "更正原因 " + p.player_id);
    const save = node("button", "保存名字");
    rename.append(name, reason, save);
    rename.onsubmit = (e) => {
      e.preventDefault();
      perform(async () => {
        await rpc("gg_admin_rename", {
          p_player_id: p.player_id,
          p_name: name.value,
          p_reason: reason.value,
        });
        await loadAccount();
        status("名字已更正；积分 ID 和原始成绩未改变。");
      });
    };
    card.append(rename);
    if (p.managing_account) {
      const unbind = node("button", "解除错误绑定", "secondary");
      unbind.onclick = () =>
        perform(async () => {
          if (!reason.reportValidity()) return;
          await rpc("gg_admin_unbind", {
            p_player_id: p.player_id,
            p_reason: reason.value,
          });
          await loadAccount();
          status("已解除绑定。原始成绩和积分保留。");
        });
      card.append(unbind);
    }
    const history = node("button", "查看原始成绩 / 名字历史", "secondary");
    history.onclick = () =>
      perform(async () => {
        const h = await rpc("gg_admin_history", { p_player_id: p.player_id });
        card.append(jsonPanel("原始来源 · " + p.player_id, h));
        status("原始记录已读取。");
      });
    card.append(history);
    $("admin-players").append(card);
  }
  $("admin-queue").replaceChildren();
  for (const c of q.claims) {
    const box = node("article", "", "panel");
    box.append(
      node("h3", c.player_id + " · " + c.status),
      node("p", "申请编号 " + c.id),
      node("p", c.evidence),
    );
    if (c.status === "pending") {
      const f = node("form"),
        r = node("textarea");
      r.required = true;
      r.minLength = 10;
      r.maxLength = 500;
      r.setAttribute("aria-label", "审核原因 " + c.id);
      const approve = node("button", "批准"),
        reject = node("button", "拒绝", "secondary");
      approve.type = reject.type = "button";
      for (const [b, yes] of [
        [approve, true],
        [reject, false],
      ])
        b.onclick = () => {
          if (!r.reportValidity()) return;
          perform(async () => {
            await rpc("gg_admin_review", {
              p_claim_id: c.id,
              p_approve: yes,
              p_reason: r.value,
            });
            await loadAccount();
            status("申请已处理。");
          });
        };
      f.append(r, approve, reject);
      box.append(f);
    }
    $("admin-queue").append(box);
  }
  if (!q.claims.length) $("admin-queue").append(node("p", "没有待审核申请。"));
  for (const f of q.feedback)
    $("admin-queue").append(jsonPanel("资料反馈 · " + f.player_id, f));
  $("audit").replaceChildren(
    ...audit.map((a) =>
      jsonPanel(a.created_at + " · " + a.action + " · " + a.target, a),
    ),
  );
}
$("auth-form").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    const email = $("email").value.trim(),
      password = $("password").value;
    if (config.turnstileSiteKey && !captchaToken)
      throw Error("CAPTCHA_REQUIRED");
    let response;
    if (mode === "signup")
      response = await client.auth.signUp({
        email,
        password,
        options: {
          captchaToken,
          emailRedirectTo: new URL("./index.html", location.href).href,
        },
      });
    else if (mode === "recover")
      response = await client.auth.resetPasswordForEmail(email, {
        captchaToken,
        redirectTo: new URL("./index.html", location.href).href,
      });
    else
      response = await client.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });
    $("password").value = "";
    if (widgetId !== undefined) {
      window.turnstile.reset(widgetId);
      captchaToken = undefined;
    }
    if (response.error) throw response.error;
    if (mode === "login") await loadAccount();
    else
      status(
        "如果此邮箱可使用该服务，将收到验证或找回邮件。请检查收件箱和垃圾邮件。",
      );
  });
};
$("logout").onclick = () =>
  perform(async () => {
    hidePrivate();
    $("auth").hidden = false;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    status("已退出。");
  });
$("reset-form").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    const { error } = await client.auth.updateUser({
      password: $("new-password").value,
    });
    $("new-password").value = "";
    if (error) throw error;
    $("recovery").hidden = true;
    await client.auth.signOut();
    hidePrivate();
    $("auth").hidden = false;
    status("密码已更新，请重新登录。");
  });
};
$("claim-form").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    await rpc("gg_claim", {
      p_player_id: $("claim-id").value.trim(),
      p_evidence: $("claim-evidence").value.trim(),
    });
    $("claim-evidence").value = "";
    await loadAccount();
    status("认领已提交，等待管理员核对。重复提交不会建立重复申请。");
  });
};
$("create-form").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    await rpc("gg_create_player", {
      p_name: $("new-name").value,
      p_confirmation: $("checked-existing").checked,
    });
    $("new-name").value = "";
    $("checked-existing").checked = false;
    await loadAccount();
    status("已建立永久 Player ID，没有新增任何成绩或积分。");
  });
};
$("feedback-form").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    await rpc("gg_feedback", {
      p_player_id: $("feedback-player").value,
      p_message: $("feedback-message").value,
    });
    $("feedback-message").value = "";
    status("反馈已提交。");
  });
};
async function startEnrollment() {
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "GG staff",
    });
    if (error) throw error;
    factorId = data.id;
    const img = node("img");
    img.className = "mfa-qr";
    img.alt = "使用验证器扫描此双重验证二维码";
    img.src = data.totp.qr_code;
    const manual = node("label", "电脑验证器：手动设置密钥（保密）");
    const secret = node("input");
    secret.type = "password";
    secret.readOnly = true;
    secret.autocomplete = "off";
    secret.value = data.totp.secret;
    secret.setAttribute("aria-label", "手动设置验证器密钥");
    manual.append(secret);
    const copySecret = node("button", "复制完整密钥", "secondary");
    copySecret.type = "button";
    copySecret.onclick = async () => {
      try {
        await navigator.clipboard.writeText(secret.value);
        status("完整密钥已复制。到 KeePassXC 的设置 TOTP 中，全选旧密钥后粘贴替换，再保存保险库。");
      } catch {
        status("浏览器未允许复制，请显示密钥后自行全选复制。", true);
      }
    };
    const reveal = node("button", "显示手动设置密钥", "secondary");
    reveal.type = "button";
    reveal.onclick = () => {
      secret.type = secret.type === "password" ? "text" : "password";
      reveal.textContent = secret.type === "password" ? "显示手动设置密钥" : "隐藏手动设置密钥";
    };
    $("mfa-setup").replaceChildren(
      img,
      node("p", "手机可扫描二维码；电脑使用下方手动密钥。不要分享或截图发送二维码及密钥。"),
      manual,
      copySecret,
      reveal,
      node("p", "KeePassXC：新建 GG 测试后台条目 → 右键条目 → TOTP → 设置 TOTP。将此密钥填入，保持默认 6 位、30 秒。保存保险库后，把生成的验证码填到下方完成验证。"),
    );
    $("enroll").hidden = true;
    $("reset-mfa").hidden = false;
    status("请输入验证器中的 6 位验证码。");
}
$("enroll").onclick = () => perform(startEnrollment);
// Older cached HTML must not break the MFA screen when JS is updated first.
if (!$("reset-mfa")) {
  const reset = node("button", "重新绑定待确认的验证器", "secondary");
  reset.id = "reset-mfa";
  reset.type = "button";
  reset.hidden = true;
  $("enroll").after(reset);
}
$("reset-mfa").onclick = () => {
  if (!window.confirm("重新绑定会让旧的待确认密钥失效。请将新密钥完整替换到 KeePassXC 中，并保存保险库。是否继续？")) return;
  perform(async () => {
    await removePendingTotp(client, factorId);
    factorId = null;
    $("mfa-setup").replaceChildren();
    $("enroll").hidden = false;
    $("reset-mfa").hidden = true;
    await startEnrollment();
    status("已生成新的待确认密钥。请完整复制到 KeePassXC，保存后再输入新验证码。");
  });
};
$("mfa-form").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    if (!factorId) {
      const {data:factors,error:factorError}=await client.auth.mfa.listFactors();
      if(factorError)throw factorError;
      factorId=selectTotpFactor(factors,null)?.id;
    }
    if (!factorId) throw Error("MFA_REQUIRED");
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId,
      code: $("mfa-code").value,
    });
    $("mfa-code").value = "";
    if (error) throw error;
    $("mfa-setup").replaceChildren();
    await loadAccount();
  });
};
$("search-form").onsubmit = (e) => {
  e.preventDefault();
  perform(loadAdmin);
};
$("admin-refresh").onclick = () => perform(loadAccount);
$("access-form").onsubmit = (e) => {
  e.preventDefault();
  perform(async () => {
    await rpc("gg_owner_access", {
      p_user_id: $("access-user").value.trim(),
      p_role: $("access-role").value,
      p_allowed: $("access-allowed").value === "true",
      p_reason: $("access-reason").value,
    });
    status("测试访问权限已保存并记录操作。");
  });
};
async function boot() {
  if (booted) return;
  hidePrivate();
  status("正在连接账号服务…");
  try {
    bundle = await fetch("../data/season.json", { cache: "no-store" }).then(
      (r) => {
        if (!r.ok) throw Error("DATA_LOAD_FAILED");
        return r.json();
      },
    );
    directory = publicPlayerDirectory(bundle);
    renderDirectory();
    client = await connect();
    if (config.turnstileSiteKey) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.onload = resolve;
        script.onerror = () => reject(Error("CAPTCHA_LOAD_FAILED"));
        document.head.append(script);
      });
      widgetId = window.turnstile.render("#captcha", {
        sitekey: config.turnstileSiteKey,
        callback: (token) => {
          captchaToken = token;
        },
        "expired-callback": () => {
          captchaToken = undefined;
        },
      });
    }
    booted = true;
    $("retry").hidden = true;
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        hidePrivate();
        $("auth").hidden = false;
        status("已退出或会话已结束。");
      }
      if (event === "PASSWORD_RECOVERY") {
        $("auth").hidden = true;
        $("recovery").hidden = false;
      }
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session && $("recovery").hidden) await loadAccount();
    else status("请登录已获准的测试账号。");
  } catch (e) {
    status(safeError(e), true);
    $("configuration").hidden = false;
    $("retry").hidden = false;
    $("submit").disabled = !client;
  }
}
$("retry").onclick = () => perform(boot);
window.addEventListener("focus", () => {
  if (client && !$("account").hidden && $("mfa").hidden) perform(loadAccount);
});
boot();
