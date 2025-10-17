import { forwardToApi } from "../_upstream";

export async function GET() {
  const res = await forwardToApi("/studios", { method: "GET" });

  return new Response(await res.text(), { status: res.status });
}
