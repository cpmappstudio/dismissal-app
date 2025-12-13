"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Search, MapPin, Plus, UserSearch, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useColumns } from "./columns";
import { Staff } from "../types";
import { StaffFormDialog } from "./staff-form-dialog";
import { DeleteStaffDialog } from "./delete-staff-dialog";
import { FilterDropdown } from "@/components/ui/filter-dropdown";


type CampusOption = {
  id: Id<"campusSettings">;
  value: string;
  label: string;
};

// Simple skeleton placeholder
function StaffTableSkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-[200px] rounded bg-muted" />
        <div className="h-8 w-[100px] rounded bg-muted" />
      </div>
      <div className="rounded-md border">
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StaffTable() {
  const t = useTranslations("staffManagement");
  const columns = useColumns();
  const { user } = useUser(); // Get current Clerk user to reload after avatar update

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Efecto para resetear la página cuando cambia la búsqueda global
  React.useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: 0,
    }));
  }, [globalFilter]);

  // Efecto para resetear la página cuando cambian los filtros de columna
  React.useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: 0,
    }));
  }, [columnFilters]);

  // Alert state
  const alertTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [alert, setAlert] = React.useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  // Function to show alerts
  const showAlert = React.useCallback(
    (type: "success" | "error", title: string, message: string) => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }

      setAlert({
        show: true,
        type,
        title,
        message,
      });

      alertTimeoutRef.current = setTimeout(() => {
        setAlert((prev) => ({ ...prev, show: false }));
        alertTimeoutRef.current = null;
      }, 5000);
    },
    [],
  );

  // Function to hide alert manually
  const hideAlert = React.useCallback(() => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
    setAlert((prev) => ({ ...prev, show: false }));
  }, []);

  // Cleanup effect for alert timeout
  React.useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  // Convex queries and actions
  const usersData = useQuery(api.users.listUsers, {});
  const campusOptions = useQuery(api.campus.getOptions, {});
  const createUser = useAction(api.users.createUserWithClerk);
  const updateUser = useAction(api.users.updateUserWithClerk);
  const deleteUser = useAction(api.users.deleteUserWithClerk);
  const saveAvatarStorageId = useMutation(api.users.saveAvatarStorageId);
  const deleteAvatar = useMutation(api.users.deleteAvatar);
  const updateClerkProfileImage = useAction(api.users.updateClerkProfileImage);

  // Helper to resolve campus name from ID
  const getCampusNameById = React.useCallback(
    (campusId: string) => {
      if (!campusOptions) return "Not Assigned";
      const campus = campusOptions.find((c: CampusOption) => c.id === campusId);
      return campus?.label || "Not Assigned";
    },
    [campusOptions],
  );

  // Helper to get campus ID from name
  const getCampusIdByName = React.useCallback(
    (campusName: string) => {
      if (!campusOptions) return null;
      const campus = campusOptions.find((c: CampusOption) => c.label === campusName);
      return campus?.id || null;
    },
    [campusOptions],
  );

  // Transform Convex users to Staff format
  const data = React.useMemo<Staff[]>(() => {
    if (!usersData) return [];

    return usersData.map((user: Doc<"users">) => ({
      id: user.clerkId,
      convexId: user._id,
      fullName:
        user.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.email ||
        "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phoneNumber: user.phone || "",
      role: user.role || "",
      // Resolve campus IDs to names for display
      assignedCampuses: (user.assignedCampuses || []).map(
        (campusId) => getCampusNameById(campusId)
      ),
      status: (user.status || "active") as "active" | "inactive",
      // Only use Clerk's imageUrl if there's no custom avatar storage ID
      // This prevents showing old Clerk image when custom avatar is removed
      avatarUrl: !user.avatarStorageId ? user.imageUrl || "" : "",
      avatarStorageId: user.avatarStorageId,
    }));
  }, [usersData, getCampusNameById]);

  const isLoading = usersData === undefined;

  // Handlers for CRUD operations
  const handleCreateStaff = async (staffData: Omit<Staff, "id">) => {
    try {
      // Convert campus names to IDs
      const campusIds = staffData.assignedCampuses
        .map((name) => getCampusIdByName(name))
        .filter((id): id is Id<"campusSettings"> => id !== null);
      
      if (campusIds.length === 0) {
        showAlert(
          "error",
          t("alerts.createError.title"),
          t("alerts.campusRequired"),
        );
        return;
      }

      // Create user in Clerk (avatar will be synced via webhook and updateUserWithClerk)
      await createUser({
        email: staffData.email,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        role: staffData.role as Role,
        assignedCampuses: campusIds,
        phone: staffData.phoneNumber || undefined,
        avatarStorageId: staffData.avatarStorageId || undefined,
      });

      showAlert(
        "success",
        t("alerts.createSuccess.title"),
        t("alerts.createSuccess.message", { name: `${staffData.firstName} ${staffData.lastName}` }),
      );
    } catch (error) {
      const err = error as Error;
      console.error("Error creating user:", err);
      showAlert(
        "error",
        t("alerts.createError.title"),
        err.message || t("alerts.createError.message"),
      );
    }
  };

  const handleDeleteStaff = async (staffIds: string[]) => {
    try {
      // Delete users sequentially
      for (const clerkId of staffIds) {
        await deleteUser({ clerkUserId: clerkId });
      }
      setRowSelection({});
      showAlert(
        "success",
        t("alerts.deleteSuccess.title"),
        t("alerts.deleteSuccess.message", { count: staffIds.length }),
      );
    } catch (error) {
      const err = error as Error;
      console.error("Error deleting users:", err);
      showAlert(
        "error",
        t("alerts.deleteError.title"),
        err.message || t("alerts.deleteError.message"),
      );
    }
  };

  const handleUpdateStaff = async (staffData: Omit<Staff, "id">) => {
    if (!selectedStaff) return;

    try {
      // Convert campus names to IDs
      const campusIds = staffData.assignedCampuses
        .map((name) => getCampusIdByName(name))
        .filter((id): id is Id<"campusSettings"> => id !== null);
      
      if (campusIds.length === 0) {
        showAlert(
          "error",
          t("alerts.updateError.title"),
          t("alerts.campusRequired"),
        );
        return;
      }

      // Check if avatar changed
      const oldAvatarId = selectedStaff.avatarStorageId;
      const newAvatarId = staffData.avatarStorageId;
      const avatarChanged = newAvatarId !== oldAvatarId;

      // Handle avatar changes in Convex Storage first
      const convexUser = usersData?.find((u) => u.clerkId === selectedStaff.id);
      if (convexUser && avatarChanged) {
        // Case 1: Avatar was removed (had one, now null/undefined)
        if (!newAvatarId && oldAvatarId) {
          await deleteAvatar({ userId: convexUser._id });
        }
        // Case 2: Avatar was replaced (had one, now has different one)
        else if (newAvatarId && oldAvatarId && newAvatarId !== oldAvatarId) {
          await saveAvatarStorageId({
            userId: convexUser._id,
            storageId: newAvatarId,
          });
        }
        // Case 3: Avatar was added (didn't have one, now has one)
        else if (newAvatarId && !oldAvatarId) {
          await saveAvatarStorageId({
            userId: convexUser._id,
            storageId: newAvatarId,
          });
        }
      }

      // Update user in Clerk (including avatarStorageId in public_metadata)
      await updateUser({
        clerkUserId: selectedStaff.id,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        role: staffData.role as Role,
        assignedCampuses: campusIds,
        phone: staffData.phoneNumber || "",
        status: staffData.status as "active" | "inactive",
        avatarStorageId: staffData.avatarStorageId || null, // Sync avatar to Clerk metadata
      });

      // Sync profile image to Clerk if avatar changed
      if (avatarChanged) {
        await updateClerkProfileImage({
          clerkUserId: selectedStaff.id,
          avatarStorageId: newAvatarId || null, // Pass storageId directly
        });

        // Reload Clerk user data to reflect new avatar in UserButton
        // This updates the UI without a full page reload
        if (user && user.id === selectedStaff.id) {
          // Multiple reload attempts to ensure Clerk has processed the new image
          // Clerk may need a moment to process the uploaded image
          await user.reload();

          // Second reload after short delay for better reliability
          setTimeout(async () => {
            try {
              await user.reload();
            } catch (error) {
              console.warn("Second reload failed, but first succeeded", error);
            }
          }, 500);

          // Third reload after slightly longer delay as final fallback
          setTimeout(async () => {
            try {
              await user.reload();
            } catch (error) {
              console.warn("Third reload failed", error);
            }
          }, 1500);
        }
      }

      setEditDialogOpen(false);
      setSelectedStaff(undefined);
      showAlert(
        "success",
        t("alerts.updateSuccess.title"),
        t("alerts.updateSuccess.message", { name: `${staffData.firstName} ${staffData.lastName}` }),
      );
    } catch (error) {
      const err = error as Error;
      console.error("Error updating user:", err);
      showAlert(
        "error",
        t("alerts.updateError.title"),
        err.message || t("alerts.updateError.message"),
      );
    }
  };

  const handleRowClick = (staff: Staff) => {
    setSelectedStaff(staff);
    setEditDialogOpen(true);
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
  });

  // Role options for the visual role filter (static, UI-only)
  const ROLE_OPTIONS = [
    "superadmin",
    "admin",
    "allocator",
    "dispatcher",
    "viewer",
    "operator",
  ] as const;

  // Extraer el tipo Role desde ROLE_OPTIONS
  type Role = (typeof ROLE_OPTIONS)[number];

  // Dialog state for create/edit
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [selectedStaff, setSelectedStaff] = React.useState<Staff | undefined>();

  if (isLoading) return <StaffTableSkeleton />;

  return (
    <div className="w-full">
      {/* Filters */}
      <div className="py-4 pt-0">
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-between md:gap-4">
          {/* Search */}
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("search.placeholder")}
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 border-2 border-yankees-blue focus:ring-yankees-blue"
              aria-label={t("search.placeholder")}
            />
          </div>

          {/* Campus filter */}
          <FilterDropdown<string>
            value={
              (table.getColumn("assignedCampuses")?.getFilterValue() as string) ??
              ""
            }
            onChange={(value: string) =>
              table.getColumn("assignedCampuses")?.setFilterValue(value)
            }
            options={campusOptions?.map((c) => c.label) ?? []}
            icon={MapPin}
            label={t("filters.campus.label")}
            placeholder={t("filters.campus.all")}
            placeholderShort={t("filters.campus.short")}
          />

          {/* Role filter - replaces Grade filter from students table */}
          <FilterDropdown<(typeof ROLE_OPTIONS)[number]>
            value={
              (table
                .getColumn("role")
                ?.getFilterValue() as (typeof ROLE_OPTIONS)[number]) ?? ""
            }
            onChange={(value: string) =>
              table.getColumn("role")?.setFilterValue(value)
            }
            options={ROLE_OPTIONS as readonly (typeof ROLE_OPTIONS)[number][]}
            icon={UserSearch}
            label={t("filters.role.label")}
            placeholder={t("filters.role.all")}
            placeholderShort={t("filters.role.short")}
          />

          {/* Actions */}
          <div className="col-span-2 flex gap-2 md:col-span-1 md:ml-auto">
            <div className="flex-1 md:flex-none">
              <StaffFormDialog
                mode="create"
                onSubmit={handleCreateStaff}
                trigger={
                  <Button className="w-full gap-2 bg-yankees-blue hover:bg-yankees-blue/90 md:w-auto">
                    <Plus className="h-4 w-4" />
                    <span className="hidden lg:inline">{t("actions.add")}</span>
                    <span className="lg:hidden">{t("actions.addShort")}</span>
                  </Button>
                }
              />
            </div>
            <div className="flex-1 md:flex-none">
              <DeleteStaffDialog
                selectedStaff={table
                  .getFilteredSelectedRowModel()
                  .rows.map((r) => r.original)}
                onDeleteStaff={handleDeleteStaff}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border-2 border-yankees-blue">
        <Table>
          <TableHeader className="bg-yankees-blue">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b-2 border-yankees-blue hover:bg-yankees-blue"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`whitespace-nowrap px-2 py-3 text-white lg:px-4 ${(header.column.columnDef.meta as { className?: string })?.className || ""}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer border-b border-yankees-blue/20 hover:bg-muted/50"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`px-2 py-3 lg:px-4 ${(cell.column.columnDef.meta as { className?: string })?.className || ""}`}
                      onClick={(e) => {
                        // Prevent row click when clicking checkbox
                        if (cell.column.id === "select") {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t("table.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>
            {t("table.pagination.selected", {
              selected: table.getFilteredSelectedRowModel().rows.length,
              total: table.getFilteredRowModel().rows.length,
            })}
          </div>
          <div className="hidden md:block">•</div>
          <div className="font-medium text-yankees-blue">
            {data.length} total staff
          </div>
          <div className="hidden md:block">•</div>
          <div className="hidden md:block">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="hidden sm:inline">
              {t("table.pagination.previous")}
            </span>
            <span className="sm:hidden">
              {t("table.pagination.previousShort")}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t("table.pagination.next")}
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      {selectedStaff && (
        <StaffFormDialog
          mode="edit"
          staff={selectedStaff}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSubmit={handleUpdateStaff}
          onDelete={async (staffId) => {
            await handleDeleteStaff([staffId]);
            setEditDialogOpen(false);
            setSelectedStaff(undefined);
          }}
        />
      )}

      {/* Alert Component - Fixed at top right */}
      {alert.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <Alert
            variant={alert.type === "error" ? "destructive" : "default"}
            className="max-w-sm w-auto bg-white shadow-lg cursor-pointer border-2 transition-all hover:shadow-xl"
            onClick={hideAlert}
          >
            {alert.type === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
            <AlertDescription className="text-sm mt-1">
              {alert.message}
              <div className="text-xs text-muted-foreground mt-1">
                {t("alerts.tapToDismiss")}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

export default StaffTable;
