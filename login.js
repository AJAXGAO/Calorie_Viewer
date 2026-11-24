"use strict";

// 登入頁：登入 UGS → 存入 sessionStorage → 跳轉到查看頁

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
// 已登入就直接到查看頁
// ==========================================
if (Calorie_Session.load()) {
  Calorie_Session.go_to_viewer();
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
// 登入
// ==========================================
async function sign_in() {
  const username = element_of("username").value.trim();
  const password = element_of("password").value;
  if (!username || !password) return write_log("請輸入帳號與密碼", false);

  const button = element_of("btn_sign_in");
  button.disabled = true;
  write_log("登入中…", true);

  try {
    const result = await Calorie_Session.send_request(CALORIE_CONFIG.UGS_SIGN_IN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ProjectId": CALORIE_CONFIG.UGS_PROJECT_ID },
      body: JSON.stringify({ username, password })
    });

    if (!result.ok || !result.data || !result.data.idToken) {
      write_log(result.status === 401 || result.status === 400
        ? "帳號或密碼錯誤"
        : "登入失敗 (" + result.status + ")：" + Calorie_Session.error_of(result), false);
      return;
    }

    Calorie_Session.save(result.data.idToken, username);
    Calorie_Session.go_to_viewer();
  } catch (e) {
    write_log(e.message, false);
  } finally {
    // 不論成功與否都清空密碼欄
    element_of("password").value = "";
    button.disabled = false;
  }
}

// ==========================================
// 綁定
// ==========================================
element_of("btn_sign_in").addEventListener("click", sign_in);
element_of("password").addEventListener("keydown", (e) => { if (e.key === "Enter") sign_in(); });
element_of("username").addEventListener("keydown", (e) => { if (e.key === "Enter") element_of("password").focus(); });
