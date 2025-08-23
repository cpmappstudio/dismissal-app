"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, Fragment, memo, useCallback } from "react"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface BreadcrumbSegment {
    title: string
    href?: string
    isCurrentPage?: boolean
}

interface RouteConfig {
    title: string
    parent?: string
    translationKey?: string
    fallback?: string
}

// Flexible route configuration - easily extensible
const ROUTE_CONFIG: Record<string, RouteConfig> = {
    'dashboard': { title: 'dashboard' },
    'academic': { title: 'menu.student.title', fallback: 'Academic' },
    'history': { title: 'menu.student.items.0.title', fallback: 'Academic History', parent: 'academic' },
    'progress': { title: 'menu.student.items.1.title', fallback: 'Academic Progress', parent: 'academic' },
    'docs': { title: 'studentDocs', fallback: 'Documentation' },
    'transcripts': { title: 'menu.studentDocs.items.0.title', fallback: 'Certificates & Transcripts', parent: 'docs' },
    'teaching': { title: 'menu.professor.title', fallback: 'Teaching' },
    'gradebook': { title: 'menu.professor.items.0.title', fallback: 'Gradebook', parent: 'teaching' },
    'admin': { title: 'academicAdmin', fallback: 'Administration' },
    'programs': { title: 'menu.adminAcademic.items.0.title', fallback: 'Program Management', parent: 'admin' },
    'courses': { title: 'menu.adminAcademic.items.1.title', fallback: 'Course Management', parent: 'admin' },
    'periods': { title: 'menu.adminAcademic.items.2.title', fallback: 'Period Management', parent: 'admin' },
    'users': { title: 'personalAdmin', fallback: 'User Management' },
    'professors': { title: 'menu.adminPersonal.items.0.title', fallback: 'Professor Management', parent: 'users' },
    'students': { title: 'menu.adminPersonal.items.1.title', fallback: 'Student Management', parent: 'users' },
    'profile': { title: 'profile', fallback: 'Profile' },
}

export const DynamicBreadcrumb = memo(function DynamicBreadcrumb() {
    const pathname = usePathname()
    const t = useTranslations('navigation')

    // Memoize path processing
    const pathWithoutLocale = useMemo(() => {
        return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
    }, [pathname])

    // Stable translation function with useCallback
    const getTranslation = useCallback((key: string, fallback: string) => {
        try {
            // Handle nested keys like "menu.student.title"
            if (key.includes('.')) {
                const result = t.raw(key as any)
                return result || fallback
            }
            return t(key as any) || fallback
        } catch {
            return fallback
        }
    }, [t])

    const breadcrumbSegments = useMemo((): BreadcrumbSegment[] => {
        const segments: BreadcrumbSegment[] = []

        // Handle root/dashboard
        if (!pathWithoutLocale || pathWithoutLocale === '/') {
            segments.push({
                title: getTranslation('dashboard', 'Dashboard'),
                isCurrentPage: true
            })
            return segments
        }

        // Split path and create segments
        const pathParts = pathWithoutLocale.split('/').filter(Boolean)

        // Build breadcrumb path
        let currentPath = ''
        pathParts.forEach((part, index) => {
            currentPath += `/${part}`
            const isLast = index === pathParts.length - 1

            // Get route config with efficient lookup
            const config = ROUTE_CONFIG[part]
            const title = config
                ? getTranslation(config.title, config.fallback || config.title)
                : part.charAt(0).toUpperCase() + part.slice(1)

            segments.push({
                title,
                href: isLast ? undefined : currentPath,
                isCurrentPage: isLast
            })
        })

        return segments
    }, [pathWithoutLocale, getTranslation])

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {breadcrumbSegments.map((segment, index) => (
                    <Fragment key={index}>
                        {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                        <BreadcrumbItem className="hidden md:block">
                            {segment.isCurrentPage ? (
                                <BreadcrumbPage>{segment.title}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink href={segment.href || "#"}>
                                    {segment.title}
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
})
