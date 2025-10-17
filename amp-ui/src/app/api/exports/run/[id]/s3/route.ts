import { forwardToApi } from "../../../../_upstream";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const response = await forwardToApi(`/exports/run/${id}/s3`, {
    method: "GET",
  });

  return new Response(await response.text(), { status: response.status });
}
