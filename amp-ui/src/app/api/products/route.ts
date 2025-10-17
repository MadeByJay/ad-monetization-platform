import { forwardToApi } from "../_upstream";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id");
  const path = brandId ? `/products?brand_id=${brandId}` : "/products";

  const res = await forwardToApi(path, { method: "GET" });

  return new Response(res.body, { status: res.status, headers: res.headers });
}
