import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

// Cache de locales con type safety fuerte
const VALID_LOCALES = new Set<string>(routing.locales);

/**
 * Helper para configurar el locale en páginas/layouts
 * Solo usar cuando sea absolutamente necesario (ej: páginas independientes)
 * La mayoría del tiempo, el layout principal ya maneja esto
 */
export async function setupLocale(params: Promise<{ locale: string }>) {
    const { locale } = await params;

    // Validación (aunque el middleware ya debería manejar esto)
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    // Enable static rendering
    setRequestLocale(locale);

    return locale;
}

/**
 * Extrae locale del pathname - O(1) performance
 * Utilizada principalmente por el middleware para determinar el locale
 */
export function getLocaleFromPathname(pathname: string): string {
    if (pathname === '/') return routing.defaultLocale;

    const idx = pathname.indexOf('/', 1);
    const segment = idx === -1 ? pathname.slice(1) : pathname.slice(1, idx);

    return VALID_LOCALES.has(segment) ? segment : routing.defaultLocale;
}


