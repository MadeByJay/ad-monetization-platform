import { forwardToApi } from "../_upstream";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const studioId = url.searchParams.get("studio_id");
  const path = studioId ? `/movies?studio_id=${studioId}` : "/movies";

  const res = await forwardToApi(path, { method: "GET" });

  return new Response(res.body, { status: res.status, headers: res.headers });
}
