// middleware.ts - Versión Optimizada para Performance

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'

// Define las rutas protegidas
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/settings(.*)',
  // Añade aquí otras rutas protegidas
])

// Define las rutas públicas (opcional, para claridad)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/about',
  '/pricing',
  // Añade aquí otras rutas públicas
])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Proteger rutas que requieren autenticación
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // Debugging en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Auth] ${req.nextUrl.pathname} - Protected: ${isProtectedRoute(req)}`)
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