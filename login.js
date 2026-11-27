"use strict";

// 登入 / 註冊頁：UGS 登入或註冊 → 存入 sessionStorage → 跳轉到查看頁

// ==========================================
// 工具
// ==========================================
const element_of = (id) => document.getElementById(id);

function write_log(text, is_ok) {
  const log = element_of("log");
  log.className = is_ok ? "ok" : "err";
  log.textContent = text;
}

// ==========================================
// 遊戲配對參數 (?link=SHA256 雜湊，base64url 43 字元)；格式不符一律忽略
// ==========================================
const LINK_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const link_param = new URLSearchParams(location.search).get("link");
const link_challenge = link_param && LINK_PATTERN.test(link_param) ? link_param : null;

// 從網址移除 link，避免重新整理或分享時重複出現
function clear_link_from_url() {
  history.replaceState(null, "", location.pathname);
}

// ==========================================
// 畫面切換：表單 / 允許配對 / 配對完成
// ==========================================
function show_area(name) {
  element_of("form_area").classList.toggle("hidden", name !== "form");
  element_of("link_area").classList.toggle("hidden", name !== "link");
  element_of("link_done").classList.toggle("hidden", name !== "done");
  if (name !== "form") element_of("title").textContent = "熱量紀錄 - 遊戲登入";
}

function show_link_request(session) {
  element_of("link_account").textContent = session.username;
  show_area("link");
}

// ==========================================
// 已登入：有配對請求就顯示允許畫面，否則直接到查看頁
// ==========================================
const existing_session = Calorie_Session.load();
if (link_param && !link_challenge) {
  write_log("遊戲登入連結無效，請回到遊戲重新按「登入」", false);
} else if (existing_session && link_challenge) {
  show_link_request(existing_session);
} else if (existing_session) {
  Calorie_Session.go_to_viewer();
} else if (link_challenge) {
  write_log("請先登入，再允許遊戲使用此帳號", true);
}

// 從查看頁被送回來時顯示原因 (只接受固定的代碼，不顯示網址上的任意文字)
const REASON_MESSAGES = {
  expired: "登入已過期，請重新登入",
  signed_out: "已登出"
};
const reason = new URLSearchParams(location.search).get("reason");
if (reason && Object.prototype.hasOwnProperty.call(REASON_MESSAGES, reason)) {
  write_log(REASON_MESSAGES[reason], reason === "signed_out");
}

// ==========================================
// 模式切換：登入 / 註冊
// ==========================================
let is_sign_up = false;

function set_mode(sign_up) {
  is_sign_up = sign_up;
  element_of("title").textContent = sign_up ? "熱量紀錄 - 註冊" : "熱量紀錄 - 登入";
  element_of("subtitle").textContent = sign_up
    ? "建立的帳號可同時用於遊戲與本網站。帳號名稱建立後無法更改。"
    : "使用遊戲或本網站建立的帳號登入。密碼只用於這次登入，不會儲存。";
  element_of("btn_submit").textContent = sign_up ? "註冊並登入" : "登入";
  element_of("btn_switch").textContent = sign_up ? "已有帳號？登入" : "還沒有帳號？註冊";
  element_of("confirm_area").classList.toggle("hidden", !sign_up);
  element_of("username_rule").classList.toggle("hidden", !sign_up);
  element_of("password_rule").classList.toggle("hidden", !sign_up);
  element_of("password").autocomplete = sign_up ? "new-password" : "current-password";
  clear_passwords();
  write_log("", true);
}

function clear_passwords() {
  element_of("password").value = "";
  element_of("password_confirm").value = "";
}

// ==========================================
// 註冊格式檢查 (與 UGS 規則相同；回傳錯誤訊息，沒有錯誤時回傳 null)
// ==========================================
const USERNAME_PATTERN = /^[a-z0-9.\-@_]{3,20}$/i;

function check_sign_up(username, password, confirm) {
  if (!USERNAME_PATTERN.test(username)) return "帳號名稱需為 3~20 字元，只能使用英文字母、數字及 . - @ _";
  if (password.length < 8 || password.length > 30) return "密碼需為 8~30 字元";
  if (!/[A-Z]/.test(password)) return "密碼需包含至少一個大寫字母";
  if (!/[a-z]/.test(password)) return "密碼需包含至少一個小寫字母";
  if (!/[0-9]/.test(password)) return "密碼需包含至少一個數字";
  if (!/[^A-Za-z0-9]/.test(password)) return "密碼需包含至少一個符號";
  if (password !== confirm) return "兩次輸入的密碼不一致";
  return null;
}

// UGS 錯誤 → 中文訊息
function message_of_failure(result) {
  const detail = Calorie_Session.error_of(result);
  const title = result.data && typeof result.data.title === "string" ? result.data.title : "";

  if (is_sign_up) {
    if (result.status === 409 || /exist|already|taken/i.test(detail + title)) return "此帳號名稱已被使用，請換一個";
    if (/password/i.test(detail + title)) return "密碼格式不符合規定";
    if (/username/i.test(detail + title)) return "帳號名稱格式不符合規定";
    return "註冊失敗 (" + result.status + ")";
  }

  if (result.status === 400 || result.status === 401 || result.status === 404) return "帳號或密碼錯誤";
  if (result.status === 429) return "嘗試次數過多，請稍後再試";
  return "登入失敗 (" + result.status + ")";
}

// ==========================================
// 送出：登入或註冊 (註冊成功時 UGS 直接回傳 token，等同登入)
// ==========================================
async function submit() {
  const username = element_of("username").value.trim();
  const password = element_of("password").value;
  if (!username || !password) return write_log("請輸入帳號與密碼", false);

  if (is_sign_up) {
    const format_error = check_sign_up(username, password, element_of("password_confirm").value);
    if (format_error) {
      clear_passwords();
      return write_log(format_error, false);
    }
  }

  const buttons = [element_of("btn_submit"), element_of("btn_switch")];
  buttons.forEach((b) => { b.disabled = true; });
  write_log(is_sign_up ? "註冊中…" : "登入中…", true);

  try {
    const result = await Calorie_Session.send_request(is_sign_up ? CALORIE_CONFIG.UGS_SIGN_UP_URL : CALORIE_CONFIG.UGS_SIGN_IN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ProjectId": CALORIE_CONFIG.UGS_PROJECT_ID },
      body: JSON.stringify({ username, password })
    });

    if (!result.ok || !result.data || !result.data.idToken) {
      write_log(message_of_failure(result), false);
      return;
    }

    Calorie_Session.save(result.data.idToken, username.toLowerCase());
    if (link_challenge) {
      write_log("", true);
      show_link_request(Calorie_Session.load());
    } else {
      Calorie_Session.go_to_viewer();
    }
  } catch (e) {
    write_log(e.message, false);
  } finally {
    // 不論成功與否都清空密碼欄
    clear_passwords();
    buttons.forEach((b) => { b.disabled = false; });
  }
}

// ==========================================
// 允許遊戲配對：POST /api/link/approve
// ==========================================
async function approve_link() {
  const session = Calorie_Session.load();
  if (!session) {
    show_area("form");
    return write_log("登入已過期，請重新登入", false);
  }

  const allow = element_of("btn_link_allow");
  allow.disabled = true;
  write_log("處理中…", true);

  try {
    const result = await Calorie_Session.send_request(CALORIE_CONFIG.API_BASE + "/link/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.token },
      body: JSON.stringify({ challenge: link_challenge, username: session.username })
    });

    if (result.status === 401) {
      Calorie_Session.clear();
      show_area("form");
      return write_log("登入已過期，請重新登入後再允許", false);
    }
    if (!result.ok) return write_log("允許失敗 (" + result.status + ")：" + Calorie_Session.error_of(result), false);

    clear_link_from_url();
    write_log("", true);
    show_area("done");
  } catch (e) {
    write_log(e.message, false);
  } finally {
    allow.disabled = false;
  }
}

function cancel_link() {
  clear_link_from_url();
  Calorie_Session.go_to_viewer();
}

// ==========================================
// 綁定
// ==========================================
element_of("btn_link_allow").addEventListener("click", approve_link);
element_of("btn_link_cancel").addEventListener("click", cancel_link);
element_of("btn_go_viewer").addEventListener("click", () => Calorie_Session.go_to_viewer());
element_of("btn_submit").addEventListener("click", submit);
element_of("btn_switch").addEventListener("click", () => set_mode(!is_sign_up));
element_of("username").addEventListener("keydown", (e) => { if (e.key === "Enter") element_of("password").focus(); });
element_of("password").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (is_sign_up) element_of("password_confirm").focus();
  else submit();
});
element_of("password_confirm").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
