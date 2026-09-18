"use client"

import * as React from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import {
    SidebarMenu,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

export function UniversityLogo() {
    const { state, isMobile } = useSidebar()
    const t = useTranslations('university')
    const isCollapsed = !isMobile && state === "collapsed"

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className={`flex w-full items-center justify-center gap-2 py-2 ${isCollapsed ? 'px-0' : 'px-1'}`}>
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center">
                        <Image
                            src="/oficial-logo-alt.png"
                            alt="Alef University"
                            width={36}
                            height={36}
                            className="object-contain"
                        />
                    </div>
                    {!isCollapsed && (
                        <span className="truncate uppercase italic text-3xl text-sidebar-primary">
                            {t('name')}
                        </span>
                    )}
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
