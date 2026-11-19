"use strict";

// ==========================================
// 防止被其他網站以 iframe 嵌入 (GitHub Pages 無法設定 frame-ancestors 標頭)
// ==========================================
if (window.top !== window.self) {
  document.getElementById("page").classList.add("hidden");
  throw new Error("此頁面不允許被嵌入");
}

// ==========================================
// 狀態：token 只存在記憶體，不寫入 localStorage / sessionStorage
// ==========================================
let id_token = null;

// ==========================================
// 工具
// ==========================================
const element_of = (id) => document.getElementById(id);
const value_of = (id) => element_of(id).value.trim();

// 輸出結果 (一律用 textContent，不解析 HTML)
function write_log(text, is_ok) {
  const log = element_of("log");
  log.className = is_ok ? "ok" : "err";
  log.textContent = text;
}

// 依登入狀態切換按鈕
function refresh_buttons() {
  const signed_in = id_token !== null;
  element_of("btn_sign_in").disabled = signed_in;
  element_of("btn_whoami").disabled = !signed_in;
  element_of("btn_bad_token").disabled = !signed_in;
  element_of("btn_sign_out").disabled = !signed_in;
  element_of("sign_in_area").classList.toggle("hidden", signed_in);
}

// 送出請求：只回傳狀態碼與伺服器的簡短 error 欄位，不把整段回應印到頁面
async function send_request(url, options) {
  let response;
  try {
    response = await fetch(url, { ...options, credentials: "omit", referrerPolicy: "no-referrer" });
  } catch {
    throw new Error("無法連線 (網路中斷，或被 CORS / CSP 擋下)");
  }

  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}

// 取出伺服器的簡短錯誤原因
function error_of(result) {
  if (result.data && typeof result.data.error === "string") return result.data.error;
  if (result.data && typeof result.data.detail === "string") return result.data.detail;   // UGS 的錯誤格式
  return "未知錯誤";
}

// ==========================================
// 1. 登入 UGS
// ==========================================
async function sign_in() {
  const username = value_of("username");
  const password = element_of("password").value;
  if (!username || !password) return write_log("請輸入帳號與密碼", false);

  try {
    const result = await send_request(CALORIE_CONFIG.UGS_SIGN_IN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ProjectId": CALORIE_CONFIG.UGS_PROJECT_ID },
      body: JSON.stringify({ username, password })
    });

    if (!result.ok || !result.data || !result.data.idToken) {
      return write_log("登入失敗 (" + result.status + ")：" + error_of(result), false);
    }

    id_token = result.data.idToken;
    write_log("登入成功，接著按「2. 呼叫 /api/whoami」", true);
  } catch (e) {
    write_log(e.message, false);
  } finally {
    // 不論成功與否都清空密碼欄
    element_of("password").value = "";
    refresh_buttons();
  }
}

// ==========================================
// 2 / 3. 呼叫 Azure /api/whoami (網址固定，token 只會送到自己的 Azure)
// ==========================================
async function call_whoami(token, expect_reject) {
  if (!token) return write_log("請先登入", false);

  try {
    const result = await send_request(CALORIE_CONFIG.API_BASE + "/whoami", {
      method: "GET",
      headers: { "Authorization": "Bearer " + token }
    });

    if (result.ok && result.data) {
      write_log("Azure 驗證成功 (200)\nplayer_id: " + result.data.player_id + "\n到期: " + result.data.expires_at, !expect_reject);
    } else {
      const passed = expect_reject && result.status === 401;
      write_log((passed ? "已正確拒絕 " : "Azure 回應 ") + result.status + "：" + error_of(result), passed);
    }
  } catch (e) {
    write_log(e.message, false);
  }
}

// ==========================================
// 登出：清除記憶體中的 token
// ==========================================
function sign_out() {
  id_token = null;
  refresh_buttons();
  write_log("已登出", true);
}

// ==========================================
// 綁定按鈕
// ==========================================
element_of("btn_sign_in").addEventListener("click", sign_in);
element_of("btn_whoami").addEventListener("click", () => call_whoami(id_token, false));
element_of("btn_bad_token").addEventListener("click", () => call_whoami(id_token ? id_token.slice(0, -4) + "AAAA" : null, true));
element_of("btn_sign_out").addEventListener("click", sign_out);
element_of("password").addEventListener("keydown", (e) => { if (e.key === "Enter") sign_in(); });
refresh_buttons();
