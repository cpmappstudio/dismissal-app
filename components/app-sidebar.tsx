"use client";

import * as React from "react";
import { BookOpen, GraduationCap, FileText, UserCog, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";

import { NavMain } from "@/components/nav-main";
import { UniversityLogo } from "@/components/university-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
// import { LangToggle } from "./lang-toggle"
import { UserButtonWrapper } from "./user-button-wrapper";
import { canAccessOperators, extractRoleFromMetadata } from "@/lib/role-utils";

// Configuración de íconos para cada tipo de menú
const iconMap = {
  management: Wrench,
  student: BookOpen,
  studentDocs: FileText,
  professor: GraduationCap,
  professorDocs: FileText,
  operators: UserCog,
  adminDocs: FileText,
} as const;

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const { user } = useUser();
  const t = useTranslations("navigation");

  // Get user role from Clerk metadata using centralized extraction
  const userRole = user
    ? extractRoleFromMetadata(user.publicMetadata)
    : undefined;

  // Generar estructura de navegación basada en el rol del usuario
  const navItems = React.useMemo(() => {
    const menuConfig = t.raw("menu") as Record<
      string,
      {
        title: string;
        url: string;
        items: Array<{ title: string; url: string }>;
      }
    >;

    const items = [];

    // Admin y SuperAdmin ven todos los enlaces
    if (userRole === "admin" || userRole === "superadmin") {
      // Usuarios con todos los sub-elementos
      if (menuConfig.management) {
        items.push({
          title: menuConfig.management.title,
          url: menuConfig.management.url,
          icon: iconMap.management,
          isActive: true,
          items: menuConfig.management.items.map((i) => ({
            title: i.title,
            url: i.url,
          })),
        });
      }

      // Documentación para administradores
      if (menuConfig.adminDocs) {
        items.push({
          title: menuConfig.adminDocs.title,
          url: menuConfig.adminDocs.url,
          icon: iconMap.adminDocs,
          isActive: false,
          items: menuConfig.adminDocs.items.map((item) => ({
            title: item.title,
            url: item.url,
          })),
        });
      }
    }

    if (menuConfig.operators && userRole) {
      const operatorItems = menuConfig.operators.items.filter((item) =>
        item.url === "/operators"
          ? canAccessOperators(userRole)
          : userRole !== "allocator" && userRole !== "dispatcher"
      );
      if (operatorItems.length > 0) {
        items.push({
          title: menuConfig.operators.title,
          url: menuConfig.operators.url,
          icon: iconMap.operators,
          isActive: true,
          items: operatorItems,
        });
      }
    }

    return items;
  }, [t, userRole]);

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
          dashboardLabel={t("dashboard")}
          navigationLabel={t("navigation")}
          showDashboard={userRole === "admin" || userRole === "superadmin"}
        />
      </SidebarContent>
      <SidebarFooter>
        {/* <LangToggle showText={state !== "collapsed"} /> */}
        {/* <ModeToggle showText={state !== "collapsed"} /> */}
        <UniversityLogo />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
