import { isValidToken } from "@/domain/accounts";

export function smsLoginCredentials(result, phone) {
  if (result?.status !== "success") throw new Error(result?.msg || "登录失败");
  if (!isValidToken(result?.ecs_token)) {
    throw new Error("后端返回的数据中缺少有效的 ecs_token");
  }

  return {
    token: String(result.ecs_token).trim(),
    onlinToken: String(result.onlin_token || "").trim(),
    phone,
    loginType: "sms",
  };
}

export function tokenLoginCredentials(value) {
  const normalizedToken = String(value || "").trim();
  if (!isValidToken(normalizedToken)) return null;

  return {
    token: normalizedToken,
    onlinToken: "",
    phone: "",
    loginType: "token",
  };
}
