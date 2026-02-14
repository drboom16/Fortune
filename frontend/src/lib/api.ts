/**
 * Secure API client using HTTPOnly cookies.
 * - Tokens are never exposed to JavaScript (stored in httpOnly cookies)
 * - credentials: 'include' sends cookies automatically
 * - On 401, attempts refresh then retries the original request
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  /** Request body. Objects are JSON-stringified automatically. */
  body?: BodyInit | object | null;
};

async function refreshTokens(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  return response.ok;
}

/**
 * Fetch with credentials. On 401, tries refresh once and retries.
 * Never sends Authorization header - cookies are used automatically.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { body, headers: customHeaders = {}, ...rest } = options;
  const headers: Record<string, string> =
    customHeaders instanceof Headers
      ? Object.fromEntries(customHeaders.entries())
      : { ...(customHeaders as Record<string, string>) };

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const buildInit = (): RequestInit => ({
    ...rest,
    credentials: "include",
    headers,
    body:
      body instanceof FormData
        ? body
        : body !== undefined && body !== null
          ? JSON.stringify(body)
          : undefined,
  });

  let response = await fetch(url, buildInit());

  if (response.status === 401 || response.status === 422) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      response = await fetch(url, buildInit());
    }
  }

  return response;
}
