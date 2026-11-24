"use strict";

// 各頁共用：防嵌入、登入狀態 (sessionStorage)、API 請求

// ==========================================
// 防止被其他網站以 iframe 嵌入 (GitHub Pages 無法設定 frame-ancestors 標頭)
// ==========================================
if (window.top !== window.self) {
  document.documentElement.classList.add("hidden");
  throw new Error("此頁面不允許被嵌入");
}

const Calorie_Session = (() => {
  // sessionStorage 只在這個分頁有效，關閉分頁即清除；不使用 localStorage
  const STORAGE_KEY = "calorie_session";

  // ==========================================
  // 解析 JWT 的到期時間 (只用於畫面判斷，真正的驗證由 Azure 負責)
  // ==========================================
  function expiry_of(token) {
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const data = JSON.parse(atob(payload));
      return typeof data.exp === "number" ? data.exp : 0;
    } catch {
      return 0;
    }
  }

  // ==========================================
  // 登入狀態
  // ==========================================
  function save(token, username) {
    const session = { token, username, expires_at: expiry_of(token) };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  // 取得有效的登入狀態；沒有或已過期時清除並回傳 null
  function load() {
    let session = null;
    try { session = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { session = null; }

    const now = Date.now() / 1000;
    if (!session || typeof session.token !== "string" ||
        session.expires_at - CALORIE_CONFIG.TOKEN_EXPIRY_MARGIN <= now) {
      clear();
      return null;
    }
    return session;
  }

  function clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  // ==========================================
  // 頁面跳轉 (replace：不留在瀏覽紀錄，上一頁不會回到已登出的頁面)
  // ==========================================
  function go_to_login(reason) {
    clear();
    const url = CALORIE_CONFIG.LOGIN_PAGE + (reason ? "?reason=" + encodeURIComponent(reason) : "");
    location.replace(url);
  }

  function go_to_viewer() {
    location.replace(CALORIE_CONFIG.VIEWER_PAGE);
  }

  // ==========================================
  // 請求：只回傳狀態碼與 JSON，不把整段回應印到頁面
  // ==========================================
  async function send_request(url, options) {
    let response;
    try {
      response = await fetch(url, { ...options, credentials: "omit", referrerPolicy: "no-referrer" });
    } catch {
      throw new Error("無法連線，請檢查網路");
    }

    let data = null;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, ok: response.ok, data };
  }

  // 呼叫 Azure API (自動帶 token；401 時回到登入頁)
  async function call_api(path, options = {}) {
    const session = load();
    if (!session) {
      go_to_login("expired");
      return null;
    }

    const headers = { ...(options.headers || {}), "Authorization": "Bearer " + session.token };
    const result = await send_request(CALORIE_CONFIG.API_BASE + path, { ...options, headers });

    if (result.status === 401) {
      go_to_login("expired");
      return null;
    }
    return result;
  }

  // 伺服器的簡短錯誤原因
  function error_of(result) {
    if (result && result.data && typeof result.data.error === "string") return result.data.error;
    if (result && result.data && typeof result.data.detail === "string") return result.data.detail;   // UGS 格式
    return "未知錯誤";
  }

  return { save, load, clear, go_to_login, go_to_viewer, send_request, call_api, error_of };
})();
