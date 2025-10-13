import { forwardToApi } from '../_upstream'

export async function GET() {
  const result = await forwardToApi('/campaigns', { method: 'GET' })

  return new Response(await result.text(), { status: result.status })
}
