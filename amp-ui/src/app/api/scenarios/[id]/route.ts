import { forwardToApi } from "../../_upstream";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const res = await forwardToApi(`/scenarios/${id}`, { method: "GET" });

  return new Response(await res.text(), { status: res.status });
}
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const body = await req.json();

  const res = await forwardToApi(`/scenarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return new Response(await res.text(), { status: res.status });
}
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const res = await forwardToApi(`/scenarios/${id}`, { method: "DELETE" });

  return new Response(await res.text(), { status: res.status });
}
