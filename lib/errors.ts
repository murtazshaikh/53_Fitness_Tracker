/**
 * Lives apart from lib/auth.ts on purpose. Importing that module pulls in
 * next-auth and, through it, next/server — so anything that merely needs to
 * recognise this error (route handlers, tests) would drag the whole auth stack
 * into its bundle.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super('Not authenticated')
    this.name = 'UnauthorizedError'
  }
}
