import { auth } from '@/lib/auth'

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: ['/workout/:path*', '/history/:path*', '/exercises/:path*'],
}
