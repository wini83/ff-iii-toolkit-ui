import { redirect } from '@sveltejs/kit';
import { decodeJwt } from "$lib/jwt";

export const load = async ({ cookies }) => {
	const token = cookies.get("access_token_client");

	if (!token) {
		// brak tokena → wywal do logowania
		throw redirect(302, "/login");
	}

	const payload = decodeJwt(token);

	if (!payload) {
		throw redirect(302, "/login");
	}

	const now = Math.floor(Date.now() / 1000);

	if (payload.exp && payload.exp < now) {
		// wygasły token → wyczyść cookie
		cookies.delete("access_token_client", { path: "/" });
		throw redirect(302, "/login");
	}

	// token OK → przepuszczamy w głąb aplikacji
	return {};
};