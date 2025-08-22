import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider"
import { shadcn } from "@clerk/themes"
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "SRU Alef University",
    description: "Alef University's student information system (SRU). A Next.js application with a clean and scalable architecture, designed to manage students grades, programs, courses, and transcripts.",
    icons: {
        icon: "/alef.ico",
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

    // Validar locale usando la configuración centralizada
    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    // Obtener mensajes para el locale
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <ClerkProvider
                        appearance={{
                            baseTheme: shadcn,
                        }}
                    >
                        <ConvexClientProvider>
                            <NextIntlClientProvider messages={messages}>
                                {children}
                            </NextIntlClientProvider>
                        </ConvexClientProvider>
                    </ClerkProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}

// Generar parámetros estáticos para build usando routing
export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}
