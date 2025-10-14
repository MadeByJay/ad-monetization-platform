import { forwardToApi } from "@/app/api/_upstream";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const url = new URL(req.url);
  const offset = url.searchParams.get("offset") ?? "0";
  const limit = url.searchParams.get("limit") ?? "50";

  const res = await forwardToApi(
    `/simulate/run/${id}/impressions?offset=${offset}&limit=${limit}`,
    { method: "GET" },
  );

  return new Response(await res.text(), { status: res.status });
}
