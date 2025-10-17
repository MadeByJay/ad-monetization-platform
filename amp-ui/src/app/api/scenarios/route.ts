import { forwardToApi } from "../_upstream";

export async function GET() {
  const result = await forwardToApi("/scenarios", { method: "GET" });

  return new Response(result.body, { status: result.status, headers: result.headers });
}

export async function POST(request: Request) {
  const body = await request.json();

  const result = await forwardToApi("/scenarios", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return new Response(result.body, { status: result.status, headers: result.headers });
}
