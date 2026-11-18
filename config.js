// 網站共用設定 (皆為公開資訊，不可放任何金鑰或密碼)
// 呼叫的網域必須同時列在各頁面 CSP 的 connect-src 中，否則瀏覽器會擋下
const CALORIE_CONFIG = Object.freeze({
  // UGS 專案 ID (公開)
  UGS_PROJECT_ID: "90b36bc5-b309-496a-a024-a1c6d99f3fbc",

  // UGS 帳號密碼登入 API
  UGS_SIGN_IN_URL: "https://player-auth.services.api.unity.com/v1/authentication/usernamepassword/sign-in",

  // Azure Function 網址 (token 只會送到這裡)
  API_BASE: "https://calorieapi-gkg4f9fph4fddpcc.westus3-01.azurewebsites.net/api"
});
