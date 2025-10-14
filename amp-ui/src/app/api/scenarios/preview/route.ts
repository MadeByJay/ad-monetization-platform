import { forwardToApi } from "../../_upstream";

export async function POST(request: Request) {
  const body = await request.json();

  const result = await forwardToApi("/scenarios/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return new Response(await result.text(), { status: result.status });
}
