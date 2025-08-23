import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import type { UserRole } from '@/convex/types'

// Crear el middleware de internacionalización usando la configuración centralizada
const intlMiddleware = createIntlMiddleware(routing)

// Solo definir rutas públicas - TODO lo demás está protegido  
const isPublicRoute = createRouteMatcher([
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
])

// Protección RBAC - Rutas específicas por rol
const isStudentOnlyRoute = createRouteMatcher([
  '/:locale/academic(.*)',
])

const isProfessorOnlyRoute = createRouteMatcher([
  '/:locale/teaching(.*)',
])

const isAdminOnlyRoute = createRouteMatcher([
  '/:locale/admin(.*)',
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

    // RBAC - Solo aplicar si el usuario está autenticado
    const userRole = (await auth()).sessionClaims?.metadata?.role as UserRole | undefined

    // Proteger rutas específicas de estudiantes
    if (isStudentOnlyRoute(req) && userRole !== 'student') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Proteger rutas específicas de profesores
    if (isProfessorOnlyRoute(req) &&
      userRole !== 'professor' && userRole !== 'admin' && userRole !== 'superadmin') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Proteger rutas específicas de administradores
    if (isAdminOnlyRoute(req) &&
      userRole !== 'admin' && userRole !== 'superadmin') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Debugging en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth] ${req.nextUrl.pathname} - Public: ${isPublicRoute(req)} - Role: ${userRole || 'none'}`)
    }
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