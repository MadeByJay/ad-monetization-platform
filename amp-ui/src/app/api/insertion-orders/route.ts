import { forwardToApi } from "../_upstream";

export async function GET() {
  const res = await forwardToApi("/insertion_orders", { method: "GET" });
  return new Response(res.body, { status: res.status, headers: res.headers });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const res = await forwardToApi("/insertion_orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return new Response(res.body, { status: res.status, headers: res.headers });
}
