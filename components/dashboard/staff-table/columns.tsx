"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Staff } from "../types";
import { UserAvatar } from "./user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const useColumns = (): ColumnDef<Staff>[] => {
  const t = useTranslations("staffManagement");

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
        >
          <span className="hidden sm:inline">{t("table.headers.name")}</span>
          <span className="sm:hidden">{t("table.headers.name")}</span>
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const staff = row.original;

        return (
          <div className="flex items-center space-x-2 min-w-0 sm:space-x-3">
            <UserAvatar
              avatarStorageId={staff.avatarStorageId}
              fallbackUrl={staff.avatarUrl}
              firstName={staff.firstName}
              lastName={staff.lastName}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate text-sm sm:text-base">
                {staff.fullName}
              </div>
              {/* Show role and campus on mobile under the name */}
              <div className="text-xs text-muted-foreground sm:hidden">
                <span className="inline-flex items-center">
                  <Badge variant="outline" className="mr-1 text-xs">
                    {staff.role}
                  </Badge>
                  <span className="truncate">
                    {staff.assignedCampuses.length === 0
                      ? "Not Assigned"
                      : staff.assignedCampuses.length === 1
                        ? staff.assignedCampuses[0]
                        : `${staff.assignedCampuses.length} campuses`}
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium hidden sm:flex text-white hover:text-white hover:bg-white/10"
        >
          {t("table.headers.email")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground hidden sm:block truncate max-w-48">
          {row.getValue("email")}
        </div>
      ),
      meta: {
        className: "hidden sm:table-cell",
      },
    },
    {
      accessorKey: "phoneNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
        >
          <span className="hidden md:inline">{t("table.headers.phone")}</span>
          <span className="md:hidden">{t("table.headers.phone")}</span>
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm hidden sm:block">
          {row.getValue("phoneNumber")}
        </div>
      ),
      meta: {
        className: "hidden sm:table-cell",
      },
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium hidden sm:flex text-white hover:text-white hover:bg-white/10"
        >
          {t("table.headers.role")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant="outline" className="hidden sm:inline-flex text-xs">
          {row.getValue("role")}
        </Badge>
      ),
      meta: {
        className: "hidden sm:table-cell",
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
        >
          {t("table.headers.status")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const status = String(row.getValue("status"));
        const variant =
          status.toLowerCase() === "active" ? "secondary" : "outline";
        return (
          <Badge variant={variant} className="text-xs">
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "assignedCampuses",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium hidden lg:flex text-white hover:text-white hover:bg-white/10"
        >
          {t("table.headers.campus")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const campuses = row.getValue("assignedCampuses") as string[];
        return (
          <div
            className="text-sm hidden lg:block truncate max-w-40"
            title={campuses.join(", ")}
          >
            {campuses.length === 0
              ? "Not Assigned"
              : campuses.length === 1
                ? campuses[0]
                : `${campuses[0]} +${campuses.length - 1}`}
          </div>
        );
      },
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue === "all") return true;
        const campuses = row.getValue(id) as string[];
        return campuses.includes(filterValue);
      },
      meta: {
        className: "hidden lg:table-cell",
      },
    },
  ];
};

// Keep old export for backward compatibility
export const columns: ColumnDef<Staff>[] = [];
