import { forwardToApi } from "../../../../../_upstream";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const res = await forwardToApi(`/simulate/run/${id}/export.csv`, {
    method: "GET",
  });

  const blob = await res.text();

  return new Response(blob, {
    status: res.status,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="run-${id}.csv"`,
    },
  });
}
