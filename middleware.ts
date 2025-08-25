import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { getLocaleFromPathname } from './lib/locale-setup'
import { checkRoleAccess } from './lib/rbac'
import type { UserRole } from '@/convex/types'

const intlMiddleware = createIntlMiddleware(routing)

const isPublicRoute = createRouteMatcher([
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/:locale/pending-role',
  '/pending-role',
  '/:locale',
  '/',
])

const DEFAULT_PATHS = {
  student: '/academic',
  professor: '/teaching',
  admin: '/admin',
  superadmin: '/admin',
} satisfies Record<UserRole, string>

const COMMON_AUTHENTICATED_ROUTES = createRouteMatcher([
  '/:locale/profile(.*)',
  '/profile(.*)',
  '/:locale/settings(.*)',
  '/settings(.*)',
  '/:locale/dashboard',
  '/dashboard',
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname, search } = req.nextUrl

  // Fast path: archivos estáticos
  if (pathname.match(/\.(jpg|jpeg|gif|png|svg|ico|webp|mp4|pdf|js|css|woff2?)$/)) {
    return NextResponse.next()
  }

  const locale = getLocaleFromPathname(pathname)

  if (isPublicRoute(req)) {
    return intlMiddleware(req)
  }

  try {
    const authObject = await auth()

    if (!authObject.userId) {
      const signInUrl = new URL(`/${locale}/sign-in`, req.url)

      const isInternalPath = pathname.startsWith('/') &&
        !pathname.startsWith('//') &&
        !pathname.includes('@')

      if (isInternalPath && pathname !== '/' && pathname !== `/${locale}`) {
        signInUrl.searchParams.set('redirect_url', pathname + search)
      }

      return NextResponse.redirect(signInUrl)
    }

    const userRole = (authObject.sessionClaims?.metadata as { role?: UserRole })?.role

    if (!userRole) {
      if (!pathname.includes('/pending-role')) {
        return NextResponse.redirect(new URL(`/${locale}/pending-role`, req.url))
      }
      return intlMiddleware(req)
    }

    if (COMMON_AUTHENTICATED_ROUTES(req)) {
      return intlMiddleware(req)
    }

    const deniedRoute = checkRoleAccess(req, userRole)

    if (deniedRoute === 'denied') {
      const redirectPath = `/${locale}${DEFAULT_PATHS[userRole]}`

      // Prevenir loop de redirección
      if (!pathname.startsWith(redirectPath)) {
        return NextResponse.redirect(new URL(redirectPath, req.url))
      }
    } else if (deniedRoute === 'unknown') {
      console.warn(`[Security] Unknown route attempted: ${pathname} by ${userRole}`)
      return NextResponse.redirect(new URL(`/${locale}${DEFAULT_PATHS[userRole]}`, req.url))
    }

    return intlMiddleware(req)

  } catch (error) {
    console.error('[Middleware] Critical error:', error)

    // En error, siempre denegar acceso
    const errorUrl = new URL(`/${locale}/sign-in`, req.url)
    errorUrl.searchParams.set('error', 'auth_error')
    return NextResponse.redirect(errorUrl)
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}