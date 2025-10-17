import { forwardToApi } from "../_upstream";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const response = await forwardToApi("/line_items", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return new Response(await response.text(), { status: response.status });
}
