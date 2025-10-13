import { forwardToApi } from '../../_upstream'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))

  const result = await forwardToApi('/simulate/run', {
    method: 'POST',
    body: JSON.stringify(body)
  })

  return new Response(await result.text(), { status: result.status })
}
