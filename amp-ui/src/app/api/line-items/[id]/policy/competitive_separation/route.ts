import { forwardToApi } from "@/app/api/_upstream";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));

  const res = await forwardToApi(
    `/line_items/${id}/policy/competitive_separation`,
    { method: "POST", body: JSON.stringify(body) },
  );

  return new Response(await res.text(), { status: res.status });
}
