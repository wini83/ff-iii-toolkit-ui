import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { loadConfig} from '$lib/config';

export async function createApiClient() {
    const { API_BASE } = await loadConfig();
    return createClient<paths>({
        baseUrl: API_BASE
    });
}
