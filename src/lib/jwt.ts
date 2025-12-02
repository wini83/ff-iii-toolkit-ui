export function decodeJwt(token: string) {
	const [, payload] = token.split(".");
	if (!payload) return null;

	try {
		return JSON.parse(atob(payload));
	} catch (e) {
		return null;
	}
}
