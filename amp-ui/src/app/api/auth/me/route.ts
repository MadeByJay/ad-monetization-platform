import { forwardToApi } from "../../_upstream";

export async function GET() {
  const response = await forwardToApi("/auth/me", { method: "GET" });

  return new Response(response.body, { status: response.status, headers: response.headers });
}
