"use strict";

// 查看頁：確認登入狀態 → 向 Azure 驗證 → 顯示資料

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
// 未登入或已過期：立即回登入頁 (畫面在確認前保持隱藏)
// ==========================================
const session = Calorie_Session.load();

// ==========================================
// 初始化：向 Azure 確認 token 有效 (無效時 call_api 會自動回登入頁)
// ==========================================
async function init() {
  try {
    const result = await Calorie_Session.call_api("/whoami", { method: "GET" });
    if (!result) return;

    document.body.classList.remove("hidden");
    element_of("account_name").textContent = session.username;
    element_of("expires_at").textContent = new Date(session.expires_at * 1000).toLocaleString("zh-TW");

    if (!result.ok) write_log("伺服器回應 " + result.status + "：" + Calorie_Session.error_of(result), false);

    // 之後在這裡呼叫 /api/records 顯示紀錄
  } catch (e) {
    document.body.classList.remove("hidden");
    write_log(e.message, false);
  }
}

// ==========================================
// 啟動：已登入才綁定登出、設定到期自動登出並載入資料
// ==========================================
if (!session) {
  Calorie_Session.go_to_login("expired");
} else {
  element_of("btn_sign_out").addEventListener("click", () => Calorie_Session.go_to_login("signed_out"));

  const remaining_ms = (session.expires_at - CALORIE_CONFIG.TOKEN_EXPIRY_MARGIN) * 1000 - Date.now();
  setTimeout(() => Calorie_Session.go_to_login("expired"), Math.max(remaining_ms, 0));

  init();
}
