"use client";

import {
  countries,
  getStatesByCountry,
  getCitiesByCountryAndState,
} from "@/lib/countries-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  Edit,
  Trash2,
  Upload,
  ImageIcon,
  ChevronDown,
  User,
  X,
  GraduationCap,
  GripVertical,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type DirectorOption = {
  id: Id<"users">;
  name: string;
  email: string | undefined;
  phone: string | undefined;
};

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { campusStatusOptions } from "@/lib/location-data";

// Grade type definition
type Grade = {
  name: string;
  code: string;
  order: number;
  isActive: boolean;
};

// Sortable Grade Badge Component
interface SortableGradeBadgeProps {
  grade: Grade;
  index: number;
  onRemove: (index: number) => void;
}

function SortableGradeBadge({
  grade,
  index,
  onRemove,
}: SortableGradeBadgeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 w-full max-w-full"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded flex-shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Badge
        variant="outline"
        className="flex items-center gap-2 px-3 py-1.5 text-sm flex-1 min-w-0"
      >
        <GraduationCap className="h-3 w-3 flex-shrink-0" />
        <span className="truncate font-medium">{grade.name}</span>
        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
          {grade.code}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          Order: {grade.order}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="ml-auto rounded-full hover:bg-muted p-0.5 flex-shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    </div>
  );
}

interface CampusSettingsDialogProps {
  campus?: Doc<"campusSettings">;
  trigger?: React.ReactNode;
}

export function CampusSettingsDialog({
  campus,
  trigger,
}: CampusSettingsDialogProps) {
  const isEditing = !!campus;
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("campusManagement");

  // Clerk user (for authentication check)
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  // Alert state
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [alert, setAlert] = useState<{
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
  const showAlert = useCallback(
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
  const hideAlert = useCallback(() => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
    setAlert((prev) => ({ ...prev, show: false }));
  }, []);

  // Cleanup effect for alert timeout
  useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  // Queries
  const potentialDirectors = useQuery(api.campus.getSuperadmins);

  // Mutations
  const createCampusMutation = useMutation(api.campus.create);
  const updateCampusMutation = useMutation(api.campus.update);
  const deleteCampusMutation = useMutation(api.campus.deleteCampus);
  const generateUploadUrl = useMutation(api.campus.generateUploadUrl);
  const deleteCampusLogo = useMutation(api.campus.deleteCampusLogo);

  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedStatus, setSelectedStatus] = useState<string>(
    campus?.status || "active",
  );
  const [selectedDirectorId, setSelectedDirectorId] = useState<
    Id<"users"> | undefined
  >(campus?.directorId || undefined);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteExistingImage, setDeleteExistingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grades state
  const [grades, setGrades] = useState<Grade[]>(campus?.availableGrades || []);
  const [newGradeName, setNewGradeName] = useState("");
  const [newGradeCode, setNewGradeCode] = useState("");
  const [useGradeTemplate, setUseGradeTemplate] = useState(false);

  // Grade template - Standard US education system
  const gradeTemplate: Grade[] = [
    { name: "Pre-K", code: "PK", order: 0, isActive: true },
    { name: "Kinder", code: "K", order: 1, isActive: true },
    { name: "1st Grade", code: "01", order: 2, isActive: true },
    { name: "2nd Grade", code: "02", order: 3, isActive: true },
    { name: "3rd Grade", code: "03", order: 4, isActive: true },
    { name: "4th Grade", code: "04", order: 5, isActive: true },
    { name: "5th Grade", code: "05", order: 6, isActive: true },
    { name: "6th Grade", code: "06", order: 7, isActive: true },
    { name: "7th Grade", code: "07", order: 8, isActive: true },
    { name: "8th Grade", code: "08", order: 9, isActive: true },
    { name: "9th Grade", code: "09", order: 10, isActive: true },
    { name: "10th Grade", code: "10", order: 11, isActive: true },
    { name: "11th Grade", code: "11", order: 12, isActive: true },
    { name: "12th Grade", code: "12", order: 13, isActive: true },
  ];

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedDirector = potentialDirectors?.find(
    (director: DirectorOption) => director.id === selectedDirectorId,
  );
  const [selectedCountry, setSelectedCountry] = useState<string>(
    campus?.address?.country || "US",
  );
  const [selectedState, setSelectedState] = useState<string>(
    campus?.address?.state || "",
  );
  const [selectedCity, setSelectedCity] = useState<string>(
    campus?.address?.city || "",
  );

  // Get available states based on selected country
  const availableStates = getStatesByCountry(selectedCountry);

  // Get available cities based on selected country and state
  const availableCities = getCitiesByCountryAndState(
    selectedCountry,
    selectedState,
  );

  // Get existing image URL if editing
  const existingLogoUrl = useQuery(
    api.campus.getLogoUrl,
    campus?.logoStorageId ? { storageId: campus.logoStorageId } : "skip",
  );

  // Sync grades state when campus prop changes (only on initial load or campus change)
  useEffect(() => {
    if (campus?.availableGrades && isOpen) {
      setGrades(campus.availableGrades);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus?._id, isOpen]);

  // Image handling functions
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setDeleteExistingImage(false);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageRemove = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteExistingImage = () => {
    setDeleteExistingImage(true);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Grade template handler
  const handleUseGradeTemplate = (checked: boolean) => {
    setUseGradeTemplate(checked);
    if (checked) {
      setGrades(gradeTemplate);
      console.log("Grade template loaded");
    } else {
      setGrades([]);
    }
  };

  // Grade handlers
  const handleAddGrade = () => {
    if (!newGradeName.trim() || !newGradeCode.trim()) {
      console.error("Grade name and code are required.");
      return;
    }

    const codeExists = grades.some(
      (grade) => grade.code.toLowerCase() === newGradeCode.trim().toLowerCase(),
    );

    if (codeExists) {
      console.error(
        `A grade with code "${newGradeCode.trim()}" already exists.`,
      );
      return;
    }

    const newGrade: Grade = {
      name: newGradeName.trim(),
      code: newGradeCode.trim(),
      order: grades.length,
      isActive: true,
    };

    setGrades([...grades, newGrade]);
    setNewGradeName("");
    setNewGradeCode("");
  };

  const handleRemoveGrade = (index: number) => {
    const updatedGrades = grades.filter((_, i) => i !== index);
    const reindexedGrades = updatedGrades.map((grade, idx) => ({
      ...grade,
      order: idx,
    }));
    setGrades(reindexedGrades);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGrades((items) => {
        const oldIndex = items.findIndex((_, idx) => idx === active.id);
        const newIndex = items.findIndex((_, idx) => idx === over.id);

        const reorderedGrades = arrayMove(items, oldIndex, newIndex);

        return reorderedGrades.map((grade, idx) => ({
          ...grade,
          order: idx,
        }));
      });
    }
  };

  // Upload image to Convex storage
  const uploadImage = async (file: File): Promise<Id<"_storage"> | null> => {
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const { storageId } = await result.json();
      return storageId as Id<"_storage">;
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    // Check if Clerk is loaded and user is authenticated
    if (!isClerkLoaded) {
      console.error("Authentication is loading, please wait...");
      return;
    }

    if (!clerkUser) {
      console.error("User not authenticated. Please log in.");
      return;
    }

    const formData = new FormData(form);
    // When editing, disabled fields are not included in FormData, so use existing campus name
    const campusName =
      (formData.get("campusName") as string) ||
      (isEditing ? campus?.campusName : null);

    if (!campusName?.trim()) {
      console.error("Validation Error: Campus name is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Handle image deletion or replacement
      if (isEditing && campus?._id && campus?.logoStorageId) {
        if (deleteExistingImage || selectedImage) {
          await deleteCampusLogo({
            campusId: campus._id,
          });
        }
      }

      // Upload new image if selected
      let uploadedLogoStorageId: Id<"_storage"> | null = null;
      if (selectedImage) {
        uploadedLogoStorageId = await uploadImage(selectedImage);
      }

      if (isEditing) {
        // Update existing campus
        const updates: {
          campusName?: string;
          description?: string;
          code?: string;
          logoStorageId?: Id<"_storage"> | null;
          directorId?: Id<"users"> | null;
          directorName?: string;
          directorEmail?: string;
          status?: "active" | "inactive" | "maintenance";
          availableGrades?: Grade[];
          address?: {
            street?: string;
            city?: string;
            state?: string;
            zipCode?: string;
            country?: string;
          };
        } = {};

        if (uploadedLogoStorageId) {
          updates.logoStorageId = uploadedLogoStorageId;
        }

        if (campusName.trim() !== campus.campusName) {
          updates.campusName = campusName.trim();
        }

        const description = formData.get("description") as string;
        if (description !== campus.description) {
          updates.description = description || undefined;
        }

        const code = formData.get("code") as string;
        if (code !== campus.code) {
          updates.code = code || undefined;
        }

        // Director fields
        if (selectedDirectorId !== campus.directorId) {
          updates.directorId = selectedDirectorId || null;
          if (selectedDirectorId) {
            const director = potentialDirectors?.find(
              (d: DirectorOption) => d.id === selectedDirectorId,
            );
            if (director) {
              updates.directorName = director.name;
              updates.directorEmail = director.email;
            }
          }
        }

        if (selectedStatus !== campus.status) {
          updates.status = selectedStatus as
            | "active"
            | "inactive"
            | "maintenance";
        }

        // Check if grades changed
        if (
          JSON.stringify(grades) !==
          JSON.stringify(campus.availableGrades || [])
        ) {
          updates.availableGrades = grades;
        }

        // Address fields
        const street = formData.get("street") as string;
        const city = formData.get("city") as string;
        const state = formData.get("state") as string;
        const zipCode = formData.get("zipCode") as string;
        const country = formData.get("country") as string;

        if (street || city || state || zipCode || country) {
          updates.address = {
            street: street || undefined,
            city: city || undefined,
            state: state || undefined,
            zipCode: zipCode || undefined,
            country: country || undefined,
          };
        }

        const hasChanges = Object.keys(updates).length > 0;
        const imageWasDeleted = deleteExistingImage && campus.logoStorageId;

        if (hasChanges || imageWasDeleted) {
          if (hasChanges) {
            await updateCampusMutation({
              campusId: campus._id,
              updates,
            });
          }

          showAlert(
            "success",
            t("alerts.updateSuccess.title"),
            t("alerts.updateSuccess.message", { name: campusName }),
          );
          setIsOpen(false);
          router.refresh();
        } else {
          showAlert(
            "success",
            t("alerts.noChanges.title"),
            t("alerts.noChanges.message"),
          );
        }
      } else {
        // Create new campus
        if (!campusName?.trim()) {
          console.error("Validation Error: Campus name is required.");
          setIsSubmitting(false);
          return;
        }

        const campusData: {
          campusName: string;
          description?: string;
          code?: string;
          logoStorageId?: Id<"_storage">;
          directorId?: Id<"users">;
          directorName?: string;
          directorEmail?: string;
          availableGrades?: Grade[];
          address?: {
            street?: string;
            city?: string;
            state?: string;
            zipCode?: string;
            country?: string;
          };
        } = {
          campusName: campusName.trim(),
        };

        if (uploadedLogoStorageId) {
          campusData.logoStorageId = uploadedLogoStorageId;
        }

        const description = formData.get("description") as string;
        if (description) {
          campusData.description = description;
        }

        const code = formData.get("code") as string;
        if (code) {
          campusData.code = code;
        }

        // Director fields
        if (selectedDirectorId) {
          const director = potentialDirectors?.find(
            (d: DirectorOption) => d.id === selectedDirectorId,
          );
          campusData.directorId = selectedDirectorId;
          if (director) {
            campusData.directorName = director.name;
            campusData.directorEmail = director.email;
          }
        }

        // Available grades (only if at least one grade)
        if (grades.length > 0) {
          campusData.availableGrades = grades;
        }

        // Address fields
        const street = formData.get("street") as string;
        const city = formData.get("city") as string;
        const state = formData.get("state") as string;
        const zipCode = formData.get("zipCode") as string;
        const country = formData.get("country") as string;

        if (street || city || state || zipCode || country) {
          campusData.address = {
            street: street || undefined,
            city: city || undefined,
            state: state || undefined,
            zipCode: zipCode || undefined,
            country: country || undefined,
          };
        }

        await createCampusMutation(campusData);

        showAlert(
          "success",
          t("alerts.createSuccess.title"),
          t("alerts.createSuccess.message", { name: campusName }),
        );
        form.reset();
        setSelectedDirectorId(undefined);
        setSelectedImage(null);
        setImagePreview(null);
        setDeleteExistingImage(false);
        setGrades([]);
        setNewGradeName("");
        setNewGradeCode("");
        setIsOpen(false);
        router.refresh();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("alerts.saveError.message");
      showAlert(
        "error",
        isEditing ? t("alerts.updateError.title") : t("alerts.createError.title"),
        errorMessage,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!campus) return;

    try {
      setIsSubmitting(true);
      
      // 1. Cerrar los diálogos primero
      setIsOpen(false);
      setShowDeleteAlert(false);
      
      // 2. Navegar ANTES de eliminar con query param para mostrar alerta en destino
      const deletedName = encodeURIComponent(campus.campusName);
      router.push(`/${locale}/management/campuses?deleted=${deletedName}`);
      
      // 3. Pequeño delay para asegurar que la navegación inicie
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 4. Ahora sí eliminar el campus
      await deleteCampusMutation({ campusId: campus._id });
      
    } catch (error) {
      // Si falla, el usuario ya está en la página de listado
      // pero el campus sigue existiendo
      const errorMessage =
        error instanceof Error ? error.message : t("alerts.deleteError.message");
      showAlert(
        "error",
        t("alerts.deleteError.title"),
        errorMessage,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = isEditing ? (
    <Button className="gap-2 cursor-pointer">
      <Edit className="h-4 w-4" />
      Edit Campus
    </Button>
  ) : (
    <Button className="bg-sidebar-accent h-9 dark:text-white gap-2">
      <Plus className="h-4 w-4" />
      <span className="hidden md:inline">Add Campus</span>
    </Button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit Campus" : "Create New Campus"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-6">
              {/* Hidden inputs */}
              <input type="hidden" name="status" value={selectedStatus} />
              <input type="hidden" name="country" value={selectedCountry} />
              <input type="hidden" name="state" value={selectedState} />
              <input type="hidden" name="city" value={selectedCity} />

              {/* Loading state */}
              {!isClerkLoaded && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  Loading authentication...
                </div>
              )}

              {/* Basic Information */}
              <div className="mt-4 space-y-4">
                <h4 className="text-sm font-medium border-b pb-2">
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-3">
                    <Label htmlFor="campusName">
                      Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="campusName"
                      name="campusName"
                      defaultValue={campus?.campusName || ""}
                      placeholder="Enter campus name"
                      required
                      disabled={isEditing}
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      name="code"
                      defaultValue={campus?.code || ""}
                      placeholder="Enter campus code"
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="status">
                      Status
                      <span className="text-red-500">*</span>
                    </Label>
                    <SelectDropdown
                      options={campusStatusOptions}
                      value={selectedStatus}
                      onValueChange={(value) => setSelectedStatus(value)}
                      placeholder="Select status..."
                      label="Status Options"
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label>Principal</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          {selectedDirector ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="font-medium">
                                {selectedDirector.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              Select a Principal
                            </span>
                          )}
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80" align="start">
                        <DropdownMenuLabel>
                          Available Principals
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {potentialDirectors?.length === 0 ? (
                          <DropdownMenuItem disabled>
                            No Principals available
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem
                              onClick={() => setSelectedDirectorId(undefined)}
                              className={!selectedDirectorId ? "bg-accent" : ""}
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span>No Principal assigned</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {potentialDirectors?.map((director: DirectorOption) => (
                              <DropdownMenuItem
                                key={director.id}
                                onClick={() =>
                                  setSelectedDirectorId(director.id)
                                }
                                className={
                                  selectedDirectorId === director.id
                                    ? "bg-accent"
                                    : ""
                                }
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span className="font-medium">
                                      {director.name}
                                    </span>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                      superadmin
                                    </span>
                                  </div>
                                  <span className="text-sm text-muted-foreground ml-6">
                                    {director.email}
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {potentialDirectors === undefined && (
                      <div className="text-sm text-muted-foreground">
                        Loading available Principals...
                      </div>
                    )}
                  </div>
                  <div className="hidden">
                    <Input
                      id="timezone"
                      name="timezone"
                      defaultValue={campus?.timezone || "America/New_York"}
                      placeholder="America/New_York"
                      required
                    />
                  </div>
                </div>
                {/* <div className="grid gap-3">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={campus?.description || ""}
                    placeholder="Optional campus description"
                    rows={3}
                  />
                </div> */}
              </div>

              {/* Grades Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium border-b pb-2">
                  Grades Offered
                </h4>
                <div className="grid gap-4">
                  {/* Use Grade Template Checkbox - Only show when creating */}
                  {!isEditing && (
                    <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
                      <Checkbox
                        id="useGradeTemplate"
                        checked={useGradeTemplate}
                        onCheckedChange={handleUseGradeTemplate}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="useGradeTemplate"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Use standard grade template
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Load all standard grades from Pre-K to 12th grade (14
                          grades total)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Display existing grades with drag & drop */}
                  {grades.length > 0 && (
                    <div className="space-y-3 overflow-hidden">
                      <Label>
                        Current Grades ({grades.length}) - Drag to reorder
                      </Label>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={grades.map((_, index) => index)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="flex flex-col gap-2 w-full overflow-hidden">
                            {grades.map((grade, index) => (
                              <SortableGradeBadge
                                key={index}
                                grade={grade}
                                index={index}
                                onRemove={handleRemoveGrade}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {/* Add new grade form */}
                  <div className="space-y-3">
                    <Label className="text-sm">Add New Grade</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="gradeName" className="text-xs">
                          Name<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="gradeName"
                          value={newGradeName}
                          onChange={(e) => setNewGradeName(e.target.value)}
                          placeholder="e.g., 1st Grade"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="gradeCode" className="text-xs">
                          Code<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="gradeCode"
                          value={newGradeCode}
                          onChange={(e) => setNewGradeCode(e.target.value)}
                          placeholder="e.g., 01"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add grades that are offered at this campus. Order will be
                      automatically assigned.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddGrade}
                      className="gap-2 self-start"
                    >
                      <Plus className="h-4 w-4" />
                      Add Grade
                    </Button>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium border-b pb-2">Address</h4>
                <div className="grid gap-4">
                  {/* Country - First */}
                  <div className="grid gap-3">
                    <Label htmlFor="country">Country</Label>
                    <SelectDropdown
                      options={countries}
                      value={selectedCountry}
                      onValueChange={(value) => {
                        setSelectedCountry(value);
                        // Reset state and city when country changes
                        setSelectedState("");
                        setSelectedCity("");
                      }}
                      placeholder="Select country..."
                      label="Countries"
                    />
                  </div>

                  {/* State and City - Second row */}
                    <div className="grid gap-3">
                      <Label htmlFor="state">
                        {selectedCountry === "HN"
                          ? "Department"
                          : selectedCountry === "PR"
                            ? "Municipality"
                            : "State"}
                      </Label>
                      <SelectDropdown
                        options={availableStates}
                        value={selectedState}
                        onValueChange={(value) => {
                          setSelectedState(value);
                          // Reset city when state changes
                          setSelectedCity("");
                        }}
                        placeholder={`Select ${selectedCountry === "HN" ? "department" : selectedCountry === "PR" ? "municipality" : "state"}...`}
                        label={
                          selectedCountry === "HN"
                            ? "Departments"
                            : selectedCountry === "PR"
                              ? "Municipalities"
                              : "States"
                        }
                        disabled={availableStates.length === 0}
                      />
                    </div>
                    {/* <div className="grid gap-3">
                      <Label htmlFor="city">City</Label>
                      <SelectDropdown
                        options={availableCities}
                        value={selectedCity}
                        onValueChange={(value) => setSelectedCity(value)}
                        placeholder={
                          availableCities.length > 0
                            ? "Select city..."
                            : "Select state first"
                        }
                        label={
                          availableCities.length > 0
                            ? "Available Cities"
                            : undefined
                        }
                        disabled={availableCities.length === 0}
                      />
                      {availableCities.length === 0 && selectedState && (
                        <p className="text-xs text-muted-foreground">
                          No major cities available for selected state
                        </p>
                      )}
                    </div> */}

                  {/* Street - Third row */}
                  <div className="grid gap-3">
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      name="street"
                      defaultValue={campus?.address?.street || ""}
                      placeholder={isEditing ? "" : "Enter street adress"}
                    />
                  </div>

                  {/* ZIP Code - Fourth row */}
                  <div className="grid gap-3">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      defaultValue={campus?.address?.zipCode || ""}
                      placeholder={isEditing ? "" : "Enter ZIP code"}
                    />
                  </div>
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium border-b pb-2">
                  Campus Logo
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label>Preview</Label>
                    <div className="aspect-video bg-muted rounded-lg relative overflow-hidden">
                      {imagePreview ? (
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      ) : existingLogoUrl && !deleteExistingImage ? (
                        <Image
                          src={existingLogoUrl}
                          alt="Current logo"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={triggerFileUpload}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Logo
                      </Button>

                      {(selectedImage || imagePreview) && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleImageRemove}
                          className="gap-2 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      )}

                      {existingLogoUrl &&
                        !deleteExistingImage &&
                        !imagePreview &&
                        isEditing && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDeleteExistingImage}
                            className="gap-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Current
                          </Button>
                        )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <div className="flex gap-2">
                {isEditing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteAlert(true)}
                    className="gap-2 mr-auto"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Campus
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting || !isClerkLoaded || !clerkUser}
                >
                  {isSubmitting
                    ? "Saving..."
                    : !isClerkLoaded
                      ? "Loading..."
                      : isEditing
                        ? "Save changes"
                        : "Create Campus"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              campus &quot;{campus?.campusName}&quot; and remove all associated
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white"
            >
              Delete Campus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Component - Fixed at top right */}
      {alert.show && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300">
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
    </>
  );
}
