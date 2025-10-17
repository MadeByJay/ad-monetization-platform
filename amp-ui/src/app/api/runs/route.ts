import { forwardToApi } from "../_upstream";

export async function GET() {
  const res = await forwardToApi("/runs", { method: "GET" });

  return new Response(res.body, { status: res.status, headers: res.headers });
}
