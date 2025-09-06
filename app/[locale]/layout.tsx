import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import ConvexClientProvider from "@/components/convex-client-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes"
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { enUS, esES } from '@clerk/localizations';

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "DismissalApp",
    description: "An innovative app that streamlines student dismissal by managing vehicle pickups efficiently and safely, ensuring a smooth process for schools and parents.",
    icons: {
        icon: "/favicon.ico",
    },
};

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;

    // Solo validar y configurar en el layout raíz
    // El middleware ya hace validación, pero esto es backup por si acaso
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    // Enable static rendering - Solo necesario aquí
    setRequestLocale(locale);

    // Obtener mensajes para el locale
    const messages = await getMessages();

    // Configurar localización de Clerk según el idioma
    const clerkLocalization = locale === 'es' ? esES : enUS;

    return (
        <html lang={locale} suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                {/* <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                > */}
                <ClerkProvider
                    appearance={{
                        baseTheme: shadcn,
                    }}
                    localization={clerkLocalization}
                    afterSignOutUrl={`/${locale}/sign-in`}
                >
                    <ConvexClientProvider>
                        <NextIntlClientProvider messages={messages}>
                            {children}
                        </NextIntlClientProvider>
                    </ConvexClientProvider>
                </ClerkProvider>
                {/* </ThemeProvider> */}
            </body>
        </html>
    );
}

// Generar parámetros estáticos para build usando routing
export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}
