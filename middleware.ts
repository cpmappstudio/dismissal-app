import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Crear el middleware de internacionalización usando la configuración centralizada
const intlMiddleware = createIntlMiddleware(routing)

// Solo definir rutas públicas - TODO lo demás está protegido  
const isPublicRoute = createRouteMatcher([
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Primero aplicar internacionalización
  const intlResponse = intlMiddleware(req)

  // Si hay redirección de idioma, aplicarla
  if (intlResponse) {
    return intlResponse
  }

  // Proteger TODO excepto rutas públicas
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // Debugging en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Auth] ${req.nextUrl.pathname} - Public: ${isPublicRoute(req)}`)
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