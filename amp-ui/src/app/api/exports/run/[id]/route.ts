import { forwardToApi } from "@/app/api/_upstream";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const response = await forwardToApi(`/rollups/run/${id}`, { method: "GET" });

  return new Response(await response.text(), { status: response.status });
}
