export async function callInternalApi(pathname: string, init?: RequestInit) {
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : // : `http://localhost:${process.env.PORT || 3001}`;
      `http://localhost:${3001}`;

  const url = new URL(`/api${pathname}`, origin).toString();

  const response = await fetch(url, { cache: "no-store", ...init });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);

  return response.json();
}
