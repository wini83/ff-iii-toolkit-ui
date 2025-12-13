import createClient from "openapi-fetch";
import type { paths } from "./schema";

export async function createApiClient() {
    return createClient<paths>({
        baseUrl: '/'
    });
}
