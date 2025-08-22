import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

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
