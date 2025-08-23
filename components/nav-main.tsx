"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, memo } from "react"
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
} from "@/components/ui/sidebar"

export const NavMain = memo(function NavMain({
  items,
  dashboardLabel,
  navigationLabel,
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
}) {
  const pathname = usePathname()

  // Memoize the path processing to avoid regex on every render
  const pathWithoutLocale = useMemo(() => {
    return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  }, [pathname])

  // Memoize the dashboard active state
  const isDashboardActive = useMemo(() => {
    return pathWithoutLocale === '' || pathWithoutLocale === '/'
  }, [pathWithoutLocale])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{navigationLabel}</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuButton
          asChild
          className={clsx({
            'bg-sidebar-accent text-sidebar-accent-foreground': isDashboardActive,
          })}
        >
          <Link href="/">
            <Home />
            <span>{dashboardLabel}</span>
          </Link>
        </SidebarMenuButton>
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
                          'bg-sidebar-accent text-sidebar-accent-foreground': pathWithoutLocale === subItem.url,
                        })}
                      >
                        <Link href={subItem.url}>
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
