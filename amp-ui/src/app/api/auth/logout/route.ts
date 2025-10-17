import { forwardToApi } from "../../_upstream";

export async function POST() {
  const response = await forwardToApi("/auth/logout", { method: "POST" });

  return new Response(await response.text(), {
    status: response.status,
    headers: response.headers,
  });
}
