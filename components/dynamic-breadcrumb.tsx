"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, Fragment, memo, useCallback } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface BreadcrumbSegment {
  title: string;
  href?: string;
  isCurrentPage?: boolean;
}

interface RouteConfig {
  title: string;
  parent?: string;
  translationKey?: string;
  fallback?: string;
}

// Flexible route configuration - easily extensible
const ROUTE_CONFIG: Record<string, RouteConfig> = {
  dashboard: { title: "dashboard" },
  academic: { title: "menu.student.title", fallback: "Academic" },
  history: {
    title: "menu.student.items.0.title",
    fallback: "Academic History",
    parent: "academic",
  },
  progress: {
    title: "menu.student.items.1.title",
    fallback: "Academic Progress",
    parent: "academic",
  },
  docs: { title: "studentDocs", fallback: "Documentation" },
  transcripts: {
    title: "menu.studentDocs.items.0.title",
    fallback: "Certificates & Transcripts",
    parent: "docs",
  },
  teaching: { title: "menu.professor.title", fallback: "Teaching" },
  gradebook: {
    title: "menu.professor.items.0.title",
    fallback: "Gradebook",
    parent: "teaching",
  },
  admin: { title: "academicAdmin", fallback: "Administration" },
  programs: {
    title: "menu.adminAcademic.items.0.title",
    fallback: "Program Management",
    parent: "admin",
  },
  courses: {
    title: "menu.adminAcademic.items.1.title",
    fallback: "Course Management",
    parent: "admin",
  },
  periods: {
    title: "menu.adminAcademic.items.2.title",
    fallback: "Period Management",
    parent: "admin",
  },
  users: { title: "personalAdmin", fallback: "User Management" },
  professors: {
    title: "menu.adminPersonal.items.0.title",
    fallback: "Professor Management",
    parent: "users",
  },
  students: {
    title: "menu.adminPersonal.items.1.title",
    fallback: "Student Management",
    parent: "users",
  },
  profile: { title: "profile", fallback: "Profile" },
};

// Routes that don't need translation (static labels)
const STATIC_ROUTES: Record<string, string> = {
  campuses: "Campuses",
  management: "Management",
  operators: "Operators",
};

// Helper to detect if a segment is a Convex ID
const isConvexId = (segment: string): boolean => {
  // Convex IDs are typically long alphanumeric strings (32+ chars)
  return segment.length > 20 && /^[a-z0-9]+$/.test(segment);
};

export const DynamicBreadcrumb = memo(function DynamicBreadcrumb() {
  const pathname = usePathname();
  const t = useTranslations("navigation");

  // Memoize path processing
  const pathWithoutLocale = useMemo(() => {
    return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  }, [pathname]);

  const { campusId } = useMemo(() => {
    const parts = pathWithoutLocale.split("/").filter(Boolean);
    const campusIndex = parts.indexOf("campuses");

    return {
      campusId:
        campusIndex !== -1 &&
        parts[campusIndex + 1] &&
        isConvexId(parts[campusIndex + 1])
          ? (parts[campusIndex + 1] as Id<"campusSettings">)
          : null,
    };
  }, [pathWithoutLocale]);

  // Fetch campus data only if campus ID is present (conditional query)
  const campusData = useQuery(
    api.campus.getById,
    campusId ? { campusId } : "skip"
  );
  // Stable translation function with useCallback
  const getTranslation = useCallback(
    (key: string, fallback: string) => {
      try {
        // Handle nested keys like "menu.student.title"
        if (key.includes(".")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = t.raw(key as any);
          return result || fallback;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return t(key as any) || fallback;
      } catch {
        return fallback;
      }
    },
    [t],
  );

  const breadcrumbSegments = useMemo((): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [];

    // Handle root/dashboard
    if (!pathWithoutLocale || pathWithoutLocale === "/") {
      segments.push({
        title: getTranslation("dashboard", "Dashboard"),
        isCurrentPage: true,
      });
      return segments;
    }

    // Split path and create segments
    const pathParts = pathWithoutLocale.split("/").filter(Boolean);

    // Build breadcrumb path
    let currentPath = "";
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      const isLast = index === pathParts.length - 1;

      // Check if this part is a campus ID and replace with campus name
      let title: string;
      if (isConvexId(part) && campusId === part) {
        // Show "Loading..." until campus data is loaded, then show campus name
        title = campusData?.campusName || "Loading...";
      } else {
        // Get route config with efficient lookup
        const config = ROUTE_CONFIG[part];
        title = config
          ? getTranslation(config.title, config.fallback || config.title)
          : STATIC_ROUTES[part] || part.charAt(0).toUpperCase() + part.slice(1);
      }

      segments.push({
        title,
        href: isLast ? undefined : currentPath,
        isCurrentPage: isLast,
      });
    });

    return segments;
  }, [pathWithoutLocale, getTranslation, campusId, campusData]);

  return (
    <Breadcrumb className="text-base">
      <BreadcrumbList className="flex-wrap gap-1">
        {breadcrumbSegments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 && <BreadcrumbSeparator className="text-base" />}
            <BreadcrumbItem className="text-base">
              {segment.isCurrentPage ? (
                <BreadcrumbPage className="text-base font-medium">
                  {segment.title}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href={segment.href || "#"}
                  className="text-base hover:text-yankees-blue transition-colors"
                >
                  {segment.title}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
});
