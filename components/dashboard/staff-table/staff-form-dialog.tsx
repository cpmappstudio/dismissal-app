"use client";

import * as React from "react";
import { BusSelect } from "@/components/dashboard/buses/bus-select";
import Image from "next/image";
import { Plus, Upload, X, Loader2, Save, Trash2, TriangleAlert, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Staff } from "../types";
import { DeleteStaffDialog } from "./delete-staff-dialog";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { normalizeVehicleIdentifier } from "@/lib/vehicle";
import { ConvexError } from "convex/values";
import {
  canCrudStaffRole,
  getCrudStaffRoles,
  type DismissalRole,
} from "@/lib/role-utils";

type CampusOption = {
  id: Id<"campusSettings">;
  value: string;
  label: string;
};

type AssignableStaffRole = Exclude<DismissalRole, "admin">;

const STAFF_ROLE_OPTIONS: AssignableStaffRole[] = [
  "bus_driver",
  "superadmin",
  "principal",
  "allocator",
  "dispatcher",
  "viewer",
  "operator",
];

interface StaffFormDialogProps {
  driversOnly?: boolean;
  mode: "create" | "edit";
  staff?: Staff;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (staff: Omit<Staff, "id">, password?: string) => Promise<void>;
  onDelete?: (staffId: string) => void;
}

export function StaffFormDialog({
  driversOnly = false,
  mode,
  staff,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSubmit,
  onDelete,
}: StaffFormDialogProps) {
  const t = useTranslations("staffManagement");
  const bt = useTranslations("transport");
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.getCurrentProfile, isAuthenticated ? {} : "skip");
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const actorRole = profile?.isActive ? profile.role : null;

  // Ref for file input to allow resetting
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Convex queries and mutations
  const campusOptions = useQuery(api.campus.getOptions, {});
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);

  // Avatar upload state
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [currentAvatarStorageId, setCurrentAvatarStorageId] =
    React.useState<Id<"_storage"> | null>(null);

  // Query to get the current avatar URL from storage ID (uses local state, not prop)
  // Skip query if currentAvatarStorageId is null (avatar explicitly removed)
  const currentAvatarUrl = useQuery(
    api.users.getAvatarUrl,
    currentAvatarStorageId !== null && currentAvatarStorageId
      ? { storageId: currentAvatarStorageId }
      : "skip",
  );

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const normalizeRole = React.useCallback(
    (role?: string): AssignableStaffRole | null => {
      const normalized = role === "admin" ? "principal" : role;
      if (
        normalized === "superadmin" ||
        normalized === "bus_driver" ||
        normalized === "principal" ||
        normalized === "operator" ||
        normalized === "allocator" ||
        normalized === "dispatcher" ||
        normalized === "viewer"
      ) {
        return normalized;
      }
      return null;
    },
    [],
  );

  const initial = React.useMemo(() => {
    if (mode === "edit" && staff) {
      return {
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email || "",
        username: staff.username || "",
        phoneNumber: staff.phoneNumber || "",
        busNumber: String(staff.busNumber ?? ""),
        role: staff.role === "admin" ? "principal" : staff.role || "",
        assignedCampuses: staff.assignedCampuses || [],
        avatarUrl: staff.avatarUrl || "",
        avatarStorageId: staff.avatarStorageId || null,
        status: staff.status || "active",
      };
    }
    return {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      phoneNumber: "",
      busNumber: "",
      role: driversOnly ? "bus_driver" : "",
      assignedCampuses: [] as string[],
      avatarUrl: "",
      avatarStorageId: null,
      status: "active",
    };
  }, [mode, staff, driversOnly]);

  const [formData, setFormData] = React.useState(initial);
  const isDriver = driversOnly || formData.role === "bus_driver";
  const buses = useQuery(api.buses.options, open && isDriver ? { forDriver: true } : "skip");
  const targetRole = normalizeRole(staff?.role || "viewer");
  const allowedCrudRoles = React.useMemo(
    () =>
      getCrudStaffRoles(actorRole).filter(
        (role): role is AssignableStaffRole => role !== "admin",
      ),
    [actorRole],
  );
  const allowedRoleSet = React.useMemo(
    () => new Set(allowedCrudRoles),
    [allowedCrudRoles],
  );
  const roleOptions = React.useMemo(
    () => STAFF_ROLE_OPTIONS.filter((role) => allowedRoleSet.has(role)),
    [allowedRoleSet],
  );
  const canEditTarget =
    mode === "edit" ? canCrudStaffRole(actorRole, targetRole) : false;
  const isSuperadminTarget = mode === "edit" && targetRole === "superadmin";
  const selectedFormRole = normalizeRole(formData.role);
  const canUseSelectedRole = selectedFormRole
    ? allowedRoleSet.has(selectedFormRole)
    : false;
  const canSubmitForm =
    mode === "create"
      ? allowedCrudRoles.length > 0 && canUseSelectedRole
      : canEditTarget && canUseSelectedRole;
  const canDeleteTarget =
    mode === "edit" && canEditTarget && !isSuperadminTarget;
  const formReadOnly = mode === "edit" && !canEditTarget;

  React.useEffect(() => {
    setPassword("");
    setSubmitError(null);
    if (open) {
      setFormData(initial);
      setAvatarFile(null);
      setAvatarPreview(null);

      // Important: Preserve undefined vs null distinction
      // undefined = field doesn't exist, null = explicitly removed
      const initialAvatarId = staff?.avatarStorageId ?? null;
      setCurrentAvatarStorageId(initialAvatarId);
    }
  }, [open, initial, staff, mode]);

  React.useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Avatar handling functions following official Convex 3-step pattern
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      // 5MB limit
      alert("File size must be less than 5MB");
      return;
    }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const uploadAvatar = async (): Promise<Id<"_storage"> | null> => {
    if (!avatarFile) return null;

    try {
      setIsUploadingAvatar(true);

      // Step 1: Generate upload URL
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": avatarFile.type },
        body: avatarFile,
      });

      if (!result.ok) {
        throw new Error("Failed to upload avatar");
      }

      const { storageId } = await result.json();

      // Step 3: Return the storage ID to be saved in handleSubmit
      // Note: We DON'T update local state here because that happens in handleSubmit
      return storageId as Id<"_storage">;
    } catch {
      alert("Failed to upload avatar. Please try again.");
      return null;
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Remove preview of newly selected image (not yet saved)
  const removePreview = () => {
    // Clear preview state only (file hasn't been uploaded yet)
    setAvatarFile(null);
    setAvatarPreview(null);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Restore original avatar storage ID if editing existing user
    // This ensures the original image is displayed again
    if (mode === "edit" && staff?.avatarStorageId) {
      setCurrentAvatarStorageId(staff.avatarStorageId);
    }
    // Note: We don't delete anything from storage because the new image
    // hasn't been uploaded yet - it only exists as a local File object
  };

  // Mark avatar for removal from DB (will be persisted on Save)
  const removeAvatar = () => {
    // Clear custom avatar state to mark for deletion
    setAvatarFile(null);
    setAvatarPreview(null);
    setCurrentAvatarStorageId(null);
    // DO NOT clear avatarUrl - keep Clerk's default profile image
    update("avatarStorageId", null);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getAvatarDisplay = () => {
    // Priority 1: New preview (user just selected a new image)
    if (avatarPreview) return avatarPreview;

    // Priority 2: If avatar was explicitly removed (null), don't show anything
    // This prevents the glitch where removed avatar briefly reappears
    if (currentAvatarStorageId === null) {
      return undefined;
    }

    // Priority 3: Current storage ID in local state and its URL
    if (currentAvatarStorageId && currentAvatarUrl) return currentAvatarUrl;

    // Priority 4: Legacy avatar URL (Clerk imageUrl) - only if we haven't removed it
    if (staff?.avatarUrl) return staff.avatarUrl;

    // No avatar to display - show initials
    return undefined;
  };

  const handleFile = handleAvatarFileSelect;

  const update = (field: string, value: string | Id<"_storage"> | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitForm || isSubmitting) return;

    if (
      !formData.firstName ||
      !formData.lastName ||
      (isDriver ? !formData.username.trim() : mode === "create" && !formData.email) ||
      !formData.role ||
      (isDriver ? !buses?.some(bus => String(bus.identifier) === formData.busNumber) : formData.assignedCampuses.length === 0)
    )
      return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Determine final avatar values
      let finalAvatarStorageId: Id<"_storage"> | undefined | null;
      let finalAvatarUrl = formData.avatarUrl;

      if (avatarFile) {
        const uploadedId = await uploadAvatar();
        if (!uploadedId) {
          alert("Failed to upload avatar. Please try again.");
          return;
        }
        finalAvatarStorageId = uploadedId;
        // Clear the legacy avatarUrl when using storage
        finalAvatarUrl = "";
      } else if (currentAvatarStorageId !== null) {
        // No new file, but currentAvatarStorageId has a value - keep it
        finalAvatarStorageId = currentAvatarStorageId;
      } else {
        // currentAvatarStorageId is null - avatar was removed or never existed
        finalAvatarStorageId = undefined;
      }

      const payload: Omit<Staff, "id"> = {
        fullName: `${formData.firstName} ${formData.lastName}`,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        username: isDriver ? formData.username.trim() : staff?.username,
        phoneNumber: formData.phoneNumber,
        role: driversOnly ? "bus_driver" : formData.role,
        busNumber:
          formData.role === "bus_driver"
            ? normalizeVehicleIdentifier(formData.busNumber)
            : undefined,
        assignedCampuses: isDriver ? [] : formData.assignedCampuses,
        status: formData.status,
        avatarUrl: finalAvatarUrl,
        avatarStorageId: finalAvatarStorageId,
      };

      await onSubmit(
        payload,
        isDriver && mode === "create" ? password : undefined,
      );
      setPassword("");
      setOpen(false);
    } catch (error) {
      setSubmitError(
        error instanceof ConvexError && typeof error.data === "string"
          ? error.data
          : bt("saveError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreate = mode === "create";
  const dialogTitle = isCreate
    ? formData.role === "bus_driver"
      ? bt("createDriver")
      : t("createDialog.title")
    : formData.role === "bus_driver"
      ? bt("editDriver")
      : t("editDialog.title");
  const dialogSubtitle = isCreate
    ? isDriver
      ? bt("driverCredentials")
      : t("createDialog.subtitle")
    : t("editDialog.subtitle");
  const submitText = isCreate
    ? t("createDialog.actions.create")
    : t("editDialog.actions.save");
  const SubmitIcon = isCreate ? Plus : Save;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold text-center">
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              {dialogSubtitle}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("createDialog.fields.firstName.label")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    placeholder={t("createDialog.fields.firstName.placeholder")}
                    disabled={formReadOnly}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("createDialog.fields.lastName.label")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    placeholder={t("createDialog.fields.lastName.placeholder")}
                    disabled={formReadOnly}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="staff-identifier"
                    className="text-sm font-medium"
                  >
                    {isDriver
                      ? bt("username")
                      : t("createDialog.fields.email.label")}{" "}
                    {(isDriver || mode === "create") && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="staff-identifier"
                    type={isDriver ? "text" : "email"}
                    autoComplete={isDriver ? "username" : "email"}
                    autoCapitalize="none"
                    spellCheck={false}
                    value={isDriver ? formData.username : formData.email}
                    onChange={(e) =>
                      update(isDriver ? "username" : "email", e.target.value)
                    }
                    placeholder={
                      isDriver
                        ? bt("username")
                        : t("createDialog.fields.email.placeholder")
                    }
                    disabled={formReadOnly}
                    readOnly={!isDriver && mode === "edit"}
                    required={isDriver || mode === "create"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("createDialog.fields.phone.label")}
                  </Label>
                  <Input
                    value={formData.phoneNumber}
                    onChange={(e) => update("phoneNumber", e.target.value)}
                    placeholder={t("createDialog.fields.phone.placeholder")}
                    disabled={formReadOnly}
                  />
                </div>
              </div>

              {isDriver && isCreate && (
                <div className="space-y-2">
                  <Label htmlFor="driver-password">
                    {bt("password")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="driver-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {bt("driverCredentials")}
                  </p>
                </div>
              )}

              <div
                className={`grid gap-4 ${driversOnly ? "grid-cols-1" : "grid-cols-2"}`}
              >
                {!driversOnly && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t("createDialog.fields.role.label")}{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      disabled={formReadOnly || isSuperadminTarget}
                      value={formData.role}
                      onValueChange={(v) => update("role", v)}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue
                          placeholder={t(
                            "createDialog.fields.role.placeholder",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r === "bus_driver" ? bt("driver") : r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!isDriver && <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("createDialog.fields.campus.label")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={formReadOnly}
                        className="w-full h-10 justify-between font-normal"
                      >
                        <span className="truncate">
                          {formData.assignedCampuses.length === 0
                            ? t("createDialog.fields.campus.placeholder")
                            : formData.assignedCampuses.length === 1
                              ? formData.assignedCampuses[0]
                              : `${formData.assignedCampuses.length} campus selected`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
                      <div className="max-h-60 overflow-y-auto p-1">
                        {campusOptions?.map((campus: CampusOption) => {
                          const isSelected = formData.assignedCampuses.includes(
                            campus.label,
                          );
                          return (
                            <div
                              key={campus.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                              onClick={() => {
                                if (formReadOnly) return;
                                setFormData((prev) => ({
                                  ...prev,
                                  assignedCampuses: isSelected
                                    ? prev.assignedCampuses.filter(
                                        (c) => c !== campus.label,
                                      )
                                    : [...prev.assignedCampuses, campus.label],
                                }));
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="pointer-events-none"
                              />
                              <span className="text-sm">{campus.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>}
              </div>

              {formData.role === "bus_driver" && (
                <div className="space-y-2">
                  <Label>{bt("bus")}</Label>
                  <BusSelect buses={buses} value={formData.busNumber} onChange={value => update("busNumber", value)} disabled={formReadOnly} />
                </div>
              )}
              {mode === "edit" && !staff?.role && canEditTarget && <p role="status" className="text-sm text-muted-foreground">{t("missingRole")}</p>}
              {formReadOnly && mode === "edit" && profile !== undefined && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <TriangleAlert className="h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {t("restrictedTitle")}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {t("restrictedDescription")}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Avatar</Label>
                    <Avatar className="h-16 w-16">
                      <AvatarImage
                        src={getAvatarDisplay()}
                        alt={`${formData.firstName} ${formData.lastName}`}
                      />
                      <AvatarFallback className="bg-muted">
                        <Image
                          src="/default-avatar.png"
                          alt="Default avatar"
                          width={64}
                          height={64}
                          className="object-cover"
                        />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploadingAvatar || formReadOnly}
                          asChild
                        >
                          <span>
                            {isUploadingAvatar ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-1" />
                            )}
                            Upload
                          </span>
                        </Button>
                      </Label>
                      <Input
                        ref={fileInputRef}
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFile}
                        className="hidden"
                        disabled={isUploadingAvatar || formReadOnly}
                      />

                      {/* Show "Clear Preview" button if there's a new preview */}
                      {avatarPreview && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removePreview}
                          disabled={isUploadingAvatar || formReadOnly}
                        >
                          <X className="h-4 w-4 mr-1" /> Clear Preview
                        </Button>
                      )}

                      {/* Show "Remove Avatar" button if there's a saved avatar and no new preview */}
                      {!avatarPreview &&
                        (currentAvatarStorageId ||
                          staff?.avatarStorageId ||
                          staff?.avatarUrl) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeAvatar}
                            disabled={isUploadingAvatar || formReadOnly}
                          >
                            <X className="h-4 w-4 mr-1" /> Remove Avatar
                          </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload an image or leave blank to show initials
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-6 border-t">
            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}
            <div className="flex gap-2 w-full justify-end">
              {canDeleteTarget && onDelete && staff && (
                <DeleteStaffDialog
                  selectedStaff={[staff]}
                  onDeleteStaff={(ids: string[]) => onDelete(ids[0])}
                  trigger={
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {t("editDialog.actions.delete")}
                      </span>
                      <span className="sm:hidden">
                        {t("actions.deleteShort")}
                      </span>
                    </Button>
                  }
                />
              )}
              <Button
                type="submit"
                disabled={!canSubmitForm || isSubmitting}
                className="bg-yankees-blue hover:bg-yankees-blue/90 gap-2"
              >
                <SubmitIcon className="h-4 w-4" />
                {submitText}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default StaffFormDialog;
