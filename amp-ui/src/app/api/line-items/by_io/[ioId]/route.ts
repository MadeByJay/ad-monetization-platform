import { forwardToApi } from "../../../_upstream";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ioId: string }> },
) {
  const { ioId } = await ctx.params;

  const res = await forwardToApi(`/line_items/by_io/${ioId}`, {
    method: "GET",
  });

  return new Response(await res.text(), { status: res.status });
}
