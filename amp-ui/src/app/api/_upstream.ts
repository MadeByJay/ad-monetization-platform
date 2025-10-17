import { headers } from "next/headers";

export const upstreamBaseUrl =
  process.env.INTERNAL_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:4311/api";

export async function forwardToApi(pathname: string, init?: RequestInit) {
  // Read the inbound request cookies and forward them to the API
  const incomingHeaders = await headers();
  const cookieHeader = incomingHeaders.get("cookie") ?? "";

  const url = `${upstreamBaseUrl}${pathname}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}), 
      ...(init?.headers || {}),
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    cache: "no-store",
  });
  return response;
}
