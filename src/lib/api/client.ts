import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { API_BASE } from "$lib/config";

export const api = createClient<paths>({
  baseUrl: API_BASE
});