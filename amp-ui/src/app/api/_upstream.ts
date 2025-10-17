import { headers } from "next/headers";

export const upstreamBaseUrl =
  process.env.INTERNAL_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:4311/api";

export async function forwardToApi(pathname: string, init?: RequestInit) {
  const incomingHeaders = await headers();
  const cookieHeader = incomingHeaders.get("cookie") ?? "";

  const url = `${upstreamBaseUrl}${pathname}`;
  const headersInit = new Headers(init?.headers);

  if (cookieHeader && !headersInit.has("cookie")) {
    headersInit.set("cookie", cookieHeader);
  }

  if (init?.body && !headersInit.has("content-type")) {
    headersInit.set("content-type", "application/json");
  }

  const requestInit: RequestInit = {
    ...init,
    headers: headersInit,
  };

  if (!requestInit.cache) {
    requestInit.cache = "no-store";
  }

  return fetch(url, requestInit);
}
