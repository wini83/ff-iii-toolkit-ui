import { redirect } from "@sveltejs/kit";
import { decodeJwt } from "$lib/jwt";

export const load = async ({ cookies, request }) => {
  const token = cookies.get("access_token_client");

  if (!token) {
    // Dla POST nie wolno redirectować → Chrome blokuje → 403
    if (request.method !== "GET") {
      return new Response("Unauthorized", { status: 401 });
    }

    throw redirect(302, "/login");
  }

  const payload = decodeJwt(token);
  if (!payload) {
    if (request.method !== "GET") return new Response("Unauthorized", { status: 401 });
    throw redirect(302, "/login");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    cookies.delete("access_token_client", { path: "/" });

    if (request.method !== "GET") return new Response("Unauthorized", { status: 401 });
    throw redirect(302, "/login");
  }

  return {};
};
