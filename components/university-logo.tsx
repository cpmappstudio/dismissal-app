"use client"

import * as React from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

export function UniversityLogo() {
    const { state } = useSidebar()
    const t = useTranslations('university')
    const isCollapsed = state === "collapsed"

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className={`flex w-full items-center gap-4 rounded-md pb-2 text-left text-sm ${isCollapsed ? 'px-0' : 'px-1'}`}>
                    <div className="flex aspect-square size-8 items-center justify-center">
                        <Image
                            src="/alef-transparent.png"
                            alt="Alef University"
                            width={36}
                            height={36}
                            className="object-contain"
                        />
                    </div>
                    <div className="grid flex-1 text-left text-sm antialiased leading-tight">
                        <span className="truncate font-serif font-medium text-base">
                            {t('name')}
                        </span>
                        <span className="truncate text-xs font-semibold text-sidebar-accent-foreground">
                            {t('academicRecords')}
                        </span>
                    </div>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
