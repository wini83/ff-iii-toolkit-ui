import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_COOKIE_META = 'auth_refresh_cookie_meta';

type SameSite = 'lax' | 'strict' | 'none';

type ParsedCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: SameSite;
};

function isSameSite(value: string): value is SameSite {
  return value === 'lax' || value === 'strict' || value === 'none';
}

function parseSetCookieHeader(value: string): ParsedCookie | null {
  const parts = value.split(';').map((part) => part.trim()).filter(Boolean);
  const [nameValue, ...attributes] = parts;
  if (!nameValue) return null;

  const separatorIndex = nameValue.indexOf('=');
  if (separatorIndex <= 0) return null;

  const name = nameValue.slice(0, separatorIndex).trim();
  const cookieValue = nameValue.slice(separatorIndex + 1);
  if (!name) return null;

  const parsed: ParsedCookie = {
    name,
    value: cookieValue,
    httpOnly: false,
    secure: false
  };

  for (const attribute of attributes) {
    const [rawKey, ...rawValueParts] = attribute.split('=');
    const key = rawKey.trim().toLowerCase();
    const attrValue = rawValueParts.join('=').trim();

    if (key === 'httponly') {
      parsed.httpOnly = true;
      continue;
    }

    if (key === 'secure') {
      parsed.secure = true;
      continue;
    }

    if (key === 'domain' && attrValue) {
      parsed.domain = attrValue;
      continue;
    }

    if (key === 'path' && attrValue) {
      parsed.path = attrValue;
      continue;
    }

    if (key === 'max-age' && attrValue) {
      const maxAge = Number.parseInt(attrValue, 10);
      if (Number.isFinite(maxAge)) parsed.maxAge = maxAge;
      continue;
    }

    if (key === 'expires' && attrValue) {
      const expires = new Date(attrValue);
      if (!Number.isNaN(expires.getTime())) parsed.expires = expires;
      continue;
    }

    if (key === 'samesite' && attrValue) {
      const sameSite = attrValue.toLowerCase();
      if (isSameSite(sameSite)) parsed.sameSite = sameSite;
    }
  }

  return parsed;
}

function authCookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !dev,
    path: '/'
  };
}

export function setAccessTokenCookie(cookies: Cookies, token: string) {
  cookies.set(ACCESS_TOKEN_COOKIE, token, authCookieBaseOptions());
}

export function propagateBackendAuthCookies(headers: Headers, cookies: Cookies) {
  const setCookieHeaders =
    typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : headers.get('set-cookie') ? [headers.get('set-cookie') as string] : [];

  for (const headerValue of setCookieHeaders) {
    const parsed = parseSetCookieHeader(headerValue);
    if (!parsed || parsed.name === ACCESS_TOKEN_COOKIE) continue;

    cookies.set(parsed.name, parsed.value, {
      httpOnly: true,
      sameSite: parsed.sameSite ?? 'lax',
      secure: !dev,
      path: parsed.path ?? '/',
      ...(parsed.domain ? { domain: parsed.domain } : {}),
      ...(parsed.expires ? { expires: parsed.expires } : {}),
      ...(parsed.maxAge !== undefined ? { maxAge: parsed.maxAge } : {})
    });

    cookies.set(
      REFRESH_COOKIE_META,
      JSON.stringify({
        name: parsed.name,
        path: parsed.path ?? '/',
        ...(parsed.domain ? { domain: parsed.domain } : {})
      }),
      authCookieBaseOptions()
    );
  }
}

export function clearAuthCookies(cookies: Cookies) {
  cookies.delete(ACCESS_TOKEN_COOKIE, { path: '/' });

  const refreshCookieMeta = cookies.get(REFRESH_COOKIE_META);
  if (refreshCookieMeta) {
    try {
      const parsed = JSON.parse(refreshCookieMeta) as { name?: string; path?: string; domain?: string };
      if (parsed.name) {
        cookies.delete(parsed.name, {
          path: parsed.path ?? '/',
          ...(parsed.domain ? { domain: parsed.domain } : {})
        });
      }
    } catch {
      // Ignore malformed metadata and still clear the metadata cookie below.
    }
  }

  cookies.delete(REFRESH_COOKIE_META, { path: '/' });
}
