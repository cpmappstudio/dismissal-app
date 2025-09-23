"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, memo, useCallback } from "react"
import { ChevronRight, Home, type LucideIcon } from "lucide-react"
import { clsx } from "clsx"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

export const NavMain = memo(function NavMain({
  items,
  dashboardLabel,
  navigationLabel,
  showDashboard = true,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
  dashboardLabel: string
  navigationLabel: string
  showDashboard?: boolean
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  // Memoize the path processing to avoid regex on every render
  const pathWithoutLocale = useMemo(() => {
    return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  }, [pathname])

  // Memoize the dashboard active state
  const isDashboardActive = useMemo(() => {
    return pathWithoutLocale === '' || pathWithoutLocale === '/'
  }, [pathWithoutLocale])

  // Handler para cerrar sidebar en móviles al hacer clic en enlaces
  const handleLinkClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{navigationLabel}</SidebarGroupLabel>
      <SidebarMenu>
        {showDashboard && (
          <SidebarMenuButton
            asChild
            className={clsx({
              'text-lime-300': isDashboardActive,
            })}
          >
            <Link href="/" onClick={handleLinkClick}>
              <Home />
              <span>{dashboardLabel}</span>
            </Link>
          </SidebarMenuButton>
        )}
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton
                        asChild
                        className={clsx({
                          'text-lime-300': pathWithoutLocale === subItem.url,
                        })}
                      >
                        <Link href={subItem.url} onClick={handleLinkClick}>
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
})
