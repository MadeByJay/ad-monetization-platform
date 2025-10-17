import { forwardToApi } from "../../_upstream";

export async function GET() {
  const response = await forwardToApi("/auth/me", { method: "GET" });

  return new Response(await response.text(), { status: response.status });
}
