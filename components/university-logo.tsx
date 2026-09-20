"use client"

import * as React from "react"
import Image from "next/image"
import {
    SidebarMenu,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

export function UniversityLogo() {
    const { state, isMobile } = useSidebar()
    const isCollapsed = !isMobile && state === "collapsed"

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className={`flex w-full items-center justify-center gap-2 py-2 ${isCollapsed ? 'px-0' : 'px-1'}`}>
                    <Image
                        src={isCollapsed ? "/favicon.svg" : "/oficial-logo.svg"}
                        alt="Dismissal"
                        width={isCollapsed ? 371 : 1349}
                        height={isCollapsed ? 394 : 395}
                        className={isCollapsed ? "size-8 shrink-0 object-contain" : "h-auto w-full max-w-48 object-contain"}
                        unoptimized
                    />
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
