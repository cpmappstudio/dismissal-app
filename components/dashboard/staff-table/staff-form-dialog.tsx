"use client";

import * as React from "react";
import Image from "next/image";
import { Plus, Upload, X, Loader2, Save, Trash2, TriangleAlert, ChevronsUpDown, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
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

type CampusOption = {
  id: Id<"campusSettings">;
  value: string;
  label: string;
};

interface StaffFormDialogProps {
  mode: "create" | "edit";
  staff?: Staff;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (staff: Omit<Staff, "id">) => void;
  onDelete?: (staffId: string) => void;
}

export function StaffFormDialog({
  mode,
  staff,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSubmit,
  onDelete,
}: StaffFormDialogProps) {
  const t = useTranslations("staffManagement");
  const [internalOpen, setInternalOpen] = React.useState(false);

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

  const initial = React.useMemo(() => {
    if (mode === "edit" && staff) {
      return {
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email || "",
        phoneNumber: staff.phoneNumber || "",
        role: staff.role || "",
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
      phoneNumber: "",
      role: "",
      assignedCampuses: [] as string[],
      avatarUrl: "",
      avatarStorageId: null,
      status: "active",
    };
  }, [mode, staff]);

  const [formData, setFormData] = React.useState(initial);

  React.useEffect(() => {
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
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.role ||
      formData.assignedCampuses.length === 0
    )
      return;

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
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        assignedCampuses: formData.assignedCampuses,
        status: formData.status,
        avatarUrl: finalAvatarUrl,
        avatarStorageId: finalAvatarStorageId,
      };

      onSubmit(payload);
      setOpen(false);
    } catch {
      alert("Failed to save user. Please try again.");
    }
  };

  const isCreate = mode === "create";
  const dialogTitle = isCreate
    ? t("createDialog.title")
    : t("editDialog.title");
  const dialogSubtitle = isCreate
    ? t("createDialog.subtitle")
    : t("editDialog.subtitle");
  const submitText = isCreate
    ? t("createDialog.actions.create")
    : t("editDialog.actions.save");
  const SubmitIcon = isCreate ? Plus : Save;

  const ROLE_OPTIONS = [
    "superadmin",
    "admin",
    "allocator",
    "dispatcher",
    "viewer",
    "operator",
  ] as const;

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
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("createDialog.fields.email.label")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder={t("createDialog.fields.email.placeholder")}
                    required
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
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("createDialog.fields.role.label")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    disabled={initial.role === "superadmin" && mode === "edit"}
                    value={formData.role}
                    onValueChange={(v) => update("role", v)}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue
                        placeholder={t("createDialog.fields.role.placeholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("createDialog.fields.campus.label")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
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
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="max-h-60 overflow-y-auto p-1">
                        {campusOptions?.map((campus: CampusOption) => {
                          const isSelected = formData.assignedCampuses.includes(campus.label);
                          return (
                            <div
                              key={campus.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  assignedCampuses: isSelected
                                    ? prev.assignedCampuses.filter((c) => c !== campus.label)
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
                </div>
              </div>

              {initial.role === "superadmin" && mode === "edit" && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <TriangleAlert className="h-5 w-5 text-amber-600"/>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {t("editDialog.protectedAccount.title")}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {t("editDialog.protectedAccount.description")}
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
                          disabled={isUploadingAvatar}
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
                        disabled={isUploadingAvatar}
                      />

                      {/* Show "Clear Preview" button if there's a new preview */}
                      {avatarPreview && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removePreview}
                          disabled={isUploadingAvatar}
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
                            disabled={isUploadingAvatar}
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
            <div className="flex gap-2 w-full justify-end">
              {mode === "edit" && onDelete && staff && (
                <DeleteStaffDialog
                  selectedStaff={[staff]}
                  onDeleteStaff={(ids: string[]) => onDelete(ids[0])}
                  trigger={
                    <Button
                      disabled={initial.role === "superadmin"}
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
