"use client"

import * as React from "react"
import {
  BookOpen,
  Bot,
  SquareTerminal,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { NavMain } from "@/components/nav-main"
import { UniversityLogo } from "@/components/university-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { ModeToggle } from "./mode-toggle"
import { LangToggle } from "./lang-toggle"
import { UserButtonWrapper } from "./user-button-wrapper"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const t = useTranslations('navigation')

  // Configuración de íconos - esto no va en traducciones
  const iconMap = {
    playground: SquareTerminal,
    models: Bot,
    documentation: BookOpen,
  } as const

  // Generar estructura de navegación desde traducciones
  const navItems = React.useMemo(() => {
    const menuConfig = t.raw('menu') as Record<string, {
      title: string;
      url: string;
      items: Array<{ title: string; url: string }>
    }>

    return Object.entries(menuConfig).map(([key, config], index) => ({
      title: config.title,
      url: config.url,
      icon: iconMap[key as keyof typeof iconMap],
      isActive: index === 0, // Solo el primero activo
      items: config.items.map(item => ({
        title: item.title,
        url: item.url,
      })),
    }))
  }, [t])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <UserButtonWrapper
          showName={state !== "collapsed"}
          collapsed={state === "collapsed"}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <LangToggle showText={state !== "collapsed"} />
        <ModeToggle showText={state !== "collapsed"} />
        <UniversityLogo />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
