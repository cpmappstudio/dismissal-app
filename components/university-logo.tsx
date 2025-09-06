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
    const { state } = useSidebar()
    const t = useTranslations('university')
    const isCollapsed = state === "collapsed"

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className={`flex w-full items-center justify-center gap-1 rounded-md pb-2  text-sm ${isCollapsed ? 'px-0' : 'px-1'}`}>
                    <div className="flex aspect-square size-8 items-center justify-center">
                        <Image
                            src="/oficial-logo-alt.png"
                            alt="Alef University"
                            width={36}
                            height={36}
                            className="object-contain"
                        />
                    </div>
                    {/* <div className="grid flex-1 text-left  text-sm antialiased leading-tight"> */}
                    <span className="truncate uppercase italic text-3xl text-lime-300">
                        {t('name')}
                    </span>

                    {/* </div> */}
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
