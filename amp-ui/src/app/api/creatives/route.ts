import { forwardToApi } from '../_upstream'

export async function GET() {
  const result = await forwardToApi('/creatives', { method: 'GET' })

  return new Response(result.body, { status: result.status, headers: result.headers })
}
