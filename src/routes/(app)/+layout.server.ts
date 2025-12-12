import { redirect, error } from "@sveltejs/kit";
import { decodeJwt } from "$lib/jwt";
console.log("HIT layout serverS");
export const load = async ({ cookies, request }) => {
  // 🚨 Endpointy i mutacje NIE są obsługiwane przez layout
  if (request.method !== "GET") {
    return {};
  }

  const token = cookies.get("access_token_client");
  if (!token) {
    throw redirect(302, "/login");
  }

  const payload = decodeJwt(token);
  if (!payload) {
    cookies.delete("access_token_client", { path: "/" });
    throw redirect(302, "/login");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    cookies.delete("access_token_client", { path: "/" });
    throw redirect(302, "/login");
  }

  return {};
};
