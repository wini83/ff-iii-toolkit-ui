import { redirect } from '@sveltejs/kit';

export const load = async ({ cookies }) => {
	const token = cookies.get("access_token_client");

	if (!token) {
		// brak tokena → wywal do logowania
		throw redirect(302, "/login");
	}

	// token OK → przepuszczamy w głąb aplikacji
	return {};
};