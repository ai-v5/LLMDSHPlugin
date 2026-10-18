/** Host half: expose per-day token usage from the Session corpus. */
import { createTokenUsageService, normalizeDays } from './lib/stats.js'

export const name = 'llm-token-usage'

export const inject = ['sessionQuery', 'connection']

const STATS_PATH = '/api/llm-token-usage/stats'

export function apply(ctx) {
  const service = createTokenUsageService(ctx.sessionQuery)
  ctx.effect(() => ctx.connection.fetch.register({
    path: STATS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: (request) => handle(ctx, service, request),
  }), 'llm-token-usage: stats route')
}

async function handle(ctx, service, request) {
  const url = new URL(request.url)
  const days = normalizeDays(url.searchParams.get('days') || 30)
  const refresh = url.searchParams.get('refresh') === '1'
  try {
    const value = await service.read({ days, refresh, signal: request.signal })
    return Response.json(value, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 })
    ctx.logger?.warn?.('llm-token-usage: stats read failed', error)
    return Response.json({ error: 'token-usage-unavailable' }, { status: 500 })
  }
}
