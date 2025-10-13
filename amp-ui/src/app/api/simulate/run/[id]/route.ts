import { forwardToApi } from "../../../_upstream";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const res = await forwardToApi(`/simulate/run/${id}`, { method: "GET" });

  return new Response(await res.text(), { status: res.status });
}
