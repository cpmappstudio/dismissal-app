"use client"

import * as React from "react"
import {
  BookOpen,
  User,
  GraduationCap,
  Settings,
  UserCog,
  FileText,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useUser } from "@clerk/nextjs"

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
import type { UserRole } from "@/convex/types"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const { user } = useUser()
  const t = useTranslations('navigation')

  // Get user role from Clerk metadata
  const userRole = user?.publicMetadata?.role as UserRole | undefined

  // Configuración de íconos para cada tipo de menú
  const iconMap = {
    profile: User,
    student: BookOpen,
    studentDocs: FileText,
    professor: GraduationCap,
    professorDocs: FileText,
    adminAcademic: Settings,
    adminPersonal: UserCog,
    adminDocs: FileText,
  } as const

  // Generar estructura de navegación basada en el rol del usuario
  const navItems = React.useMemo(() => {
    const menuConfig = t.raw('menu') as Record<string, {
      title: string;
      url: string;
      items: Array<{ title: string; url: string }>
    }>

    const items = []

    // Eliminar "Mi Cuenta" para todos los roles
    // Menús específicos por rol
    if (userRole === 'student') {
      // Mi Estudio
      if (menuConfig.student) {
        items.push({
          title: menuConfig.student.title,
          url: menuConfig.student.url,
          icon: iconMap.student,
          isActive: true, // Dashboard activo por defecto
          items: menuConfig.student.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }

      // Documentación para estudiantes
      if (menuConfig.studentDocs) {
        items.push({
          title: menuConfig.studentDocs.title,
          url: menuConfig.studentDocs.url,
          icon: iconMap.studentDocs,
          isActive: false,
          items: menuConfig.studentDocs.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }
    }

    if (userRole === 'professor') {
      // Mis Clases
      if (menuConfig.professor) {
        items.push({
          title: menuConfig.professor.title,
          url: menuConfig.professor.url,
          icon: iconMap.professor,
          isActive: true,
          items: menuConfig.professor.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }

      // Documentación para profesores
      if (menuConfig.professorDocs) {
        items.push({
          title: menuConfig.professorDocs.title,
          url: menuConfig.professorDocs.url,
          icon: iconMap.professorDocs,
          isActive: false,
          items: menuConfig.professorDocs.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }
    }

    if ((userRole === 'admin' || userRole === 'superadmin')) {
      // Administración Académica
      if (menuConfig.adminAcademic) {
        items.push({
          title: menuConfig.adminAcademic.title,
          url: menuConfig.adminAcademic.url,
          icon: iconMap.adminAcademic,
          isActive: true,
          items: menuConfig.adminAcademic.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }

      // Administración Personal
      if (menuConfig.adminPersonal) {
        items.push({
          title: menuConfig.adminPersonal.title,
          url: menuConfig.adminPersonal.url,
          icon: iconMap.adminPersonal,
          isActive: false,
          items: menuConfig.adminPersonal.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }

      // Documentación para administradores
      if (menuConfig.adminDocs) {
        items.push({
          title: menuConfig.adminDocs.title,
          url: menuConfig.adminDocs.url,
          icon: iconMap.adminDocs,
          isActive: false,
          items: menuConfig.adminDocs.items.map(item => ({
            title: item.title,
            url: item.url,
          })),
        })
      }
    }

    return items
  }, [t, userRole])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <UserButtonWrapper
          showName={state !== "collapsed"}
          collapsed={state === "collapsed"}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navItems}
          dashboardLabel={t('dashboard')}
          navigationLabel={t('navigation')}
        />
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
