import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { getLocaleFromPathname } from './lib/locale-setup'
import { extractRoleFromMetadata } from './lib/role-utils'
import type { DismissalRole } from './lib/role-utils'

const intlMiddleware = createIntlMiddleware(routing)

// ============================================================
// CONFIGURACIÓN DE RUTAS Y ROLES
// ============================================================

const PUBLIC_ROUTES = createRouteMatcher([
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/:locale/pending-role',
  '/pending-role',
])

const COMMON_AUTHENTICATED_ROUTES = createRouteMatcher([
  '/:locale/profile(.*)',
  '/profile(.*)',
  '/:locale/settings(.*)',
  '/settings(.*)',
])

// Rutas por defecto para cada rol (donde redirigir cuando acceden a rutas no permitidas)
const DEFAULT_REDIRECTS: Record<DismissalRole, string> = {
  superadmin: '/users/staff',
  admin: '/users/staff',
  operator: '/operators/allocator',
  allocator: '/operators/allocator',
  dispatcher: '/operators/dispatcher',
  viewer: '/operators/viewer',
}

// Definición de permisos por rol - más restrictivo
const ROLE_PERMISSIONS: Record<DismissalRole, {
  allowed: string[]
  canAccessAll?: boolean
}> = {
  superadmin: {
    canAccessAll: true, // Puede acceder a todas las rutas
    allowed: []
  },
  admin: {
    canAccessAll: true, // Puede acceder a todas las rutas  
    allowed: []
  },
  operator: {
    allowed: [
      '/operators/allocator',
      '/operators/dispatcher',
      '/operators/viewer'
    ]
  },
  allocator: {
    allowed: ['/operators/allocator']
  },
  dispatcher: {
    allowed: ['/operators/dispatcher']
  },
  viewer: {
    allowed: ['/operators/viewer']
  }
}

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

/**
 * Verifica si un archivo es estático
 */
const isStaticFile = (pathname: string): boolean => {
  return /\.(jpg|jpeg|gif|png|svg|ico|webp|mp4|pdf|js|css|woff2?)$/.test(pathname)
}

/**
 * Obtiene la ruta sin el locale y la normaliza para prevenir path traversal
 */
const getPathWithoutLocale = (pathname: string): string => {
  const cleanPath = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/'

  // Normalizar para prevenir path traversal attacks
  return cleanPath
    .replace(/\/+/g, '/') // Múltiples slashes a uno solo
    .replace(/\/\.\//g, '/') // Remover /./ 
    .replace(/\/\.\.$/, '') // Remover /.. al final
    .replace(/\/\.\.\//g, '/') // Remover /../
    || '/'
}

/**
 * Verifica si el usuario puede acceder a una ruta específica
 */
const canAccessRoute = (userRole: DismissalRole, path: string): boolean => {
  const permissions = ROLE_PERMISSIONS[userRole]

  // Si tiene acceso completo (superadmin/admin)
  if (permissions.canAccessAll) {
    return true
  }

  // Verificar rutas permitidas
  return permissions.allowed.some(allowedPath => {
    // Coincidencia exacta o que empiece con la ruta permitida
    return path === allowedPath || path.startsWith(`${allowedPath}/`)
  })
}

/**
 * Determina si debe redirigir y a dónde
 */
const getRedirectUrl = (
  userRole: DismissalRole,
  pathWithoutLocale: string,
  locale: string,
  baseUrl: string
): URL | null => {
  // REGLA 1: Admin y superadmin pueden ver el dashboard en la raíz
  // Otros roles son redirigidos a su ruta específica
  if (pathWithoutLocale === '/') {
    if (userRole === 'admin' || userRole === 'superadmin') {
      return null // Permitir acceso al dashboard
    }
    return new URL(`/${locale}${DEFAULT_REDIRECTS[userRole]}`, baseUrl)
  }

  // REGLA 2: Verificar si puede acceder a la ruta actual
  if (!canAccessRoute(userRole, pathWithoutLocale)) {
    return new URL(`/${locale}${DEFAULT_REDIRECTS[userRole]}`, baseUrl)
  }

  return null
}

// ============================================================
// MIDDLEWARE PRINCIPAL
// ============================================================

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname, search } = req.nextUrl

  // Optimización: bypass para archivos estáticos
  if (isStaticFile(pathname)) {
    return NextResponse.next()
  }

  const locale = getLocaleFromPathname(pathname)

  // Manejo de rutas públicas
  if (PUBLIC_ROUTES(req)) {
    return intlMiddleware(req)
  }

  try {
    const authObject = await auth()

    // Usuario no autenticado
    if (!authObject.userId) {
      const signInUrl = new URL(`/${locale}/sign-in`, req.url)

      // Preservar la URL de redirección si es válida
      const isValidRedirect = pathname.startsWith('/') &&
        !pathname.startsWith('//') &&
        !pathname.includes('@')

      if (isValidRedirect && pathname !== '/' && pathname !== `/${locale}`) {
        signInUrl.searchParams.set('redirect_url', pathname + search)
      }

      return NextResponse.redirect(signInUrl)
    }

    // Obtener rol del usuario usando sistema centralizado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = extractRoleFromMetadata(authObject.sessionClaims as any)

    // Usuario sin rol asignado
    if (!userRole) {
      if (!pathname.includes('/pending-role')) {
        return NextResponse.redirect(new URL(`/${locale}/pending-role`, req.url))
      }
      return intlMiddleware(req)
    }

    // Rutas comunes autenticadas (profile, settings, dashboard)
    if (COMMON_AUTHENTICATED_ROUTES(req)) {
      return intlMiddleware(req)
    }

    // Verificar permisos de acceso con el nuevo sistema restrictivo
    const pathWithoutLocale = getPathWithoutLocale(pathname)
    const redirectUrl = getRedirectUrl(userRole, pathWithoutLocale, locale, req.url)

    if (redirectUrl) {
      // Prevenir loops de redirección
      if (redirectUrl.pathname !== pathname) {
        return NextResponse.redirect(redirectUrl)
      }

      // Si hay un loop, denegar acceso
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Permitir acceso
    return intlMiddleware(req)

  } catch (error) {
    // En caso de error, redirigir a sign-in
    const errorUrl = new URL(`/${locale}/sign-in`, req.url)
    errorUrl.searchParams.set('error', 'auth_error')
    return NextResponse.redirect(errorUrl)
  }
})

// ============================================================
// CONFIGURACIÓN DEL MATCHER
// ============================================================

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
