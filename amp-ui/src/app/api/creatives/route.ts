import { forwardToApi } from '../_upstream'

export async function GET() {
  const result = await forwardToApi('/creatives', { method: 'GET' })
  
  return new Response(await result.text(), { status: result.status })
}
