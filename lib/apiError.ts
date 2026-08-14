import { UnauthorizedError } from './errors'

/**
 * Route handlers wrap their bodies in try/catch and delegate here, so an
 * unauthenticated call is a 401 rather than a 500 with a stack trace.
 */
export function handleApiError(e: unknown): Response {
  if (e instanceof UnauthorizedError) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }
  console.error(e)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
