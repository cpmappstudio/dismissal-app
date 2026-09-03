"use client"

import * as React from "react"
import { Plus, CalendarIcon, Trash2, Save, Upload, X, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { useTranslations } from 'next-intl'
import { useMutation, useQuery } from "convex/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Student, Grade } from "../types"
import { DeleteStudentsDialog } from "./delete-students-dialog"
import { CampusOption, GRADES } from "@/convex/types"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface StudentFormDialogProps {
    mode: 'create' | 'edit'
    student?: Student
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSubmit: (student: Omit<Student, 'id'>) => void
    onDelete?: (studentId: string) => void
}

export function StudentFormDialog({
    mode,
    student,
    trigger,
    open: controlledOpen,
    onOpenChange,
    onSubmit,
    onDelete
}: StudentFormDialogProps) {
    const t = useTranslations('studentsManagement')
    const [internalOpen, setInternalOpen] = React.useState(false)

    // Ref for file input to allow resetting
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Convex mutations for avatar handling
    const generateUploadUrl = useMutation(api.students.generateAvatarUploadUrl)
    
    // Query for campus options (dynamic)
    const campusOptions = useQuery(api.campus.getOptions, {})

    // Avatar upload state
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
    const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false)
    const [currentAvatarStorageId, setCurrentAvatarStorageId] = React.useState<Id<"_storage"> | null>(null)

    // Query to get the current avatar URL from storage ID (uses local state, not prop)
    const currentAvatarUrl = useQuery(
        api.students.getAvatarUrl,
        currentAvatarStorageId ? { storageId: currentAvatarStorageId } : "skip"
    )

    // Use controlled or internal state
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    // Initialize form data based on mode
    const initialFormData = React.useMemo(() => {
        if (mode === 'edit' && student) {
            return {
                firstName: student.firstName,
                lastName: student.lastName,
                carNumber: student.carNumber?.toString() || "",
                grade: student.grade,
                campusId: student.campusId,
                avatarUrl: student.avatarUrl || "",
                avatarStorageId: student.avatarStorageId || null
            }
        }
        return {
            firstName: "",
            lastName: "",
            carNumber: "",
            grade: "" as Grade | "",
            campusId: "" as Id<"campusSettings"> | "",
            avatarUrl: "",
            avatarStorageId: null as Id<"_storage"> | null
        }
    }, [mode, student])

    const [date, setDate] = React.useState<Date | undefined>(() => {
        if (mode === 'edit' && student?.birthday) {
            return new Date(student.birthday)
        }
        return undefined
    })

    const [formData, setFormData] = React.useState(initialFormData)

    // Reset form when student changes or dialog opens
    React.useEffect(() => {
        if (open) {
            setFormData(initialFormData)
            if (mode === 'edit' && student?.birthday) {
                setDate(new Date(student.birthday))
            } else {
                setDate(undefined)
            }

            // Reset avatar state
            setAvatarFile(null)
            setAvatarPreview(null)
            setCurrentAvatarStorageId(student?.avatarStorageId || null)
        }
    }, [open, initialFormData, mode, student])

    // Cleanup preview URL on unmount
    React.useEffect(() => {
        return () => {
            if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview)
            }
        }
    }, [avatarPreview])

    // Avatar handling functions following official Convex 3-step pattern
    const handleAvatarFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            // Validate file type and size
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file')
                return
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert('File size must be less than 5MB')
                return
            }

            setAvatarFile(file)

            // Create preview URL
            const previewUrl = URL.createObjectURL(file)
            setAvatarPreview(previewUrl)
        }
    }

    const uploadAvatar = async (): Promise<Id<"_storage"> | null> => {
        if (!avatarFile) return null

        try {
            setIsUploadingAvatar(true)

            // Step 1: Generate upload URL
            const uploadUrl = await generateUploadUrl()

            // Step 2: Upload file to Convex storage
            const result = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": avatarFile.type },
                body: avatarFile,
            })

            if (!result.ok) {
                throw new Error("Failed to upload avatar")
            }

            const { storageId } = await result.json()

            // Step 3: Return the storage ID to be saved in handleSubmit
            // Note: Old avatar deletion is handled by saveAvatarStorageId mutation
            return storageId as Id<"_storage">

        } catch {
            alert("Failed to upload avatar. Please try again.")
            return null
        } finally {
            setIsUploadingAvatar(false)
        }
    }

    // Remove preview of newly selected image (not yet saved)
    const removePreview = () => {
        // Clear preview state only (file hasn't been uploaded yet)
        setAvatarFile(null)
        setAvatarPreview(null)
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        
        // Restore original avatar storage ID if editing existing student
        if (mode === 'edit' && student?.avatarStorageId) {
            setCurrentAvatarStorageId(student.avatarStorageId)
        }
        // Note: We don't delete anything from storage because the new image
        // hasn't been uploaded yet - it only exists as a local File object
    }

    // Mark avatar for removal from DB (will be persisted on Save)
    const removeAvatar = () => {
        // Clear avatar state to mark for deletion
        setAvatarFile(null)
        setAvatarPreview(null)
        setCurrentAvatarStorageId(null)
        updateFormData("avatarStorageId", null)
        // Note: avatarUrl is legacy, kept for backward compatibility
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const getAvatarDisplay = () => {
        // Priority 1: New preview (user just selected a new image)
        if (avatarPreview) return avatarPreview
        
        // Priority 2: Current storage ID in local state and its URL
        if (currentAvatarStorageId && currentAvatarUrl) return currentAvatarUrl
        
        // Priority 3: If currentAvatarStorageId is null but student originally had one,
        // user clicked Remove Avatar - don't show anything (will show initials)
        if (currentAvatarStorageId === null && student?.avatarStorageId) {
            return undefined
        }
        
        // Priority 4: Legacy avatar URL (for backward compatibility)
        if (student?.avatarUrl) return student.avatarUrl
        
        // No avatar to display - show initials
        return undefined
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.firstName || !formData.lastName || !date || !formData.grade || !formData.campusId) {
            return // Basic validation
        }

        try {
            // Determine final avatar values
            let finalAvatarStorageId: Id<"_storage"> | undefined
            let finalAvatarUrl = formData.avatarUrl

            if (avatarFile) {
                // New file uploaded - use it
                const uploadedId = await uploadAvatar()
                if (!uploadedId) {
                    alert("Failed to upload avatar. Please try again.")
                    return
                }
                finalAvatarStorageId = uploadedId
                // Clear the legacy avatarUrl when using storage
                finalAvatarUrl = ""
            } else if (currentAvatarStorageId !== null) {
                // No new file, but currentAvatarStorageId has a value - keep it
                finalAvatarStorageId = currentAvatarStorageId
            } else {
                // currentAvatarStorageId is null - avatar was removed or never existed
                finalAvatarStorageId = undefined
            }

            // No automatic avatar generation - let component show initials as fallback

            // Get campus name for display
            const campusName = campusOptions?.find((c: CampusOption) => c.id === formData.campusId)?.label || "Unknown"

            const studentData = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                fullName: `${formData.firstName} ${formData.lastName}`,
                birthday: date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }),
                carNumber: formData.carNumber ? parseInt(formData.carNumber) : 0,
                grade: formData.grade as Grade,
                campusId: formData.campusId as Id<"campusSettings">,
                campusLocation: campusName,
                avatarUrl: finalAvatarUrl,
                avatarStorageId: finalAvatarStorageId
            }

            onSubmit(studentData)
            setOpen(false)
        } catch {
            alert("Failed to save student. Please try again.")
        }
    }

    const handleDelete = (studentIds: string[]) => {
        if (onDelete && studentIds.length > 0) {
            onDelete(studentIds[0]) // Solo necesitamos el primer ID ya que es un solo estudiante
            setOpen(false)
        }
    }

    const updateFormData = (field: string, value: string | Id<"_storage"> | null) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const isCreate = mode === 'create'
    const dialogTitle = isCreate ? t('createDialog.title') : t('editDialog.title')
    const dialogSubtitle = isCreate ? t('createDialog.subtitle') : t('editDialog.subtitle')
    const submitButtonText = isCreate ? t('createDialog.actions.create') : t('editDialog.actions.save')
    const SubmitIcon = isCreate ? Plus : Save

    const dialogContent = (
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
                <DialogHeader className="space-y-3">
                    <DialogTitle className="text-xl font-semibold text-center">{dialogTitle}</DialogTitle>
                    <DialogDescription className="text-center text-muted-foreground">
                        {dialogSubtitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-6">
                    {/* Personal Information Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <div className="h-2 w-2 rounded-full bg-yankees-blue"></div>
                            <h3 className="text-sm font-medium text-yankees-blue">{t('createDialog.sections.personal')}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName" className="text-sm font-medium">
                                    {t('createDialog.fields.firstName.label')} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="firstName"
                                    value={formData.firstName}
                                    onChange={(e) => updateFormData("firstName", e.target.value)}
                                    placeholder={t('createDialog.fields.firstName.placeholder')}
                                    className="h-10"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName" className="text-sm font-medium">
                                    {t('createDialog.fields.lastName.label')} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="lastName"
                                    value={formData.lastName}
                                    onChange={(e) => updateFormData("lastName", e.target.value)}
                                    placeholder={t('createDialog.fields.lastName.placeholder')}
                                    className="h-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                {t('createDialog.fields.birthday.label')} <span className="text-destructive">*</span>
                            </Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full h-10 justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : <span>{t('createDialog.fields.birthday.placeholder')}</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                        captionLayout="dropdown"
                                        className="rounded-md border shadow-sm"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Academic Information Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <div className="h-2 w-2 rounded-full bg-yankees-blue"></div>
                            <h3 className="text-sm font-medium text-yankees-blue">{t('createDialog.sections.academic')}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="grade" className="text-sm font-medium">
                                    {t('createDialog.fields.grade.label')} <span className="text-destructive">*</span>
                                </Label>
                                <Select value={formData.grade} onValueChange={(value) => updateFormData("grade", value)}>
                                    <SelectTrigger className="w-full h-10">
                                        <SelectValue placeholder={t('createDialog.fields.grade.placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GRADES.map((grade) => (
                                            <SelectItem key={grade} value={grade}>
                                                {grade}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="campus" className="text-sm font-medium">
                                    {t('createDialog.fields.campus.label')} <span className="text-destructive">*</span>
                                </Label>
                                <Select value={formData.campusId as string} onValueChange={(value) => updateFormData("campusId", value as Id<"campusSettings">)}>
                                    <SelectTrigger className="w-full h-10">
                                        <SelectValue placeholder={t('createDialog.fields.campus.placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {campusOptions?.map((campus: CampusOption) => (
                                            <SelectItem key={campus.id} value={campus.id}>
                                                {campus.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Additional Information Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                            <h3 className="text-sm font-medium text-muted-foreground">{t('createDialog.sections.additional')}</h3>
                        </div>

                        {/* Avatar Section */}
                        <div className="space-y-4">
                            <div className="flex items-end gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Avatar</Label>
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage
                                            src={getAvatarDisplay()}
                                            alt={`${formData.firstName} ${formData.lastName}`}
                                        />
                                        <AvatarFallback>
                                            {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
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
                                            onChange={handleAvatarFileSelect}
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
                                                <X className="h-4 w-4 mr-1" />
                                                Clear Preview
                                            </Button>
                                        )}

                                        {/* Show "Remove Avatar" button if there's a saved avatar and no new preview */}
                                        {!avatarPreview && (currentAvatarStorageId || student?.avatarStorageId || student?.avatarUrl) && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={removeAvatar}
                                                disabled={isUploadingAvatar}
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                Remove Avatar
                                            </Button>
                                        )}
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        Upload an image or leave blank to show initials
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Car Number Section */}
                        <div className="space-y-2">
                            <Label htmlFor="carNumber" className="text-sm font-medium">{t('createDialog.fields.carNumber.label')}</Label>
                            <Input
                                id="carNumber"
                                type="number"
                                value={formData.carNumber}
                                onChange={(e) => updateFormData("carNumber", e.target.value)}
                                placeholder="0"
                                className="h-10"
                                min="0"
                            />
                        </div>

                        {/* Legacy Avatar URL (for compatibility) */}
                        {formData.avatarUrl && !currentAvatarStorageId && (
                            <div className="space-y-2">
                                <Label htmlFor="avatarUrl" className="text-sm font-medium">Legacy Avatar URL</Label>
                                <Input
                                    id="avatarUrl"
                                    value={formData.avatarUrl}
                                    onChange={(e) => updateFormData("avatarUrl", e.target.value)}
                                    placeholder="https://example.com/avatar.jpg"
                                    className="h-10"
                                />
                            </div>
                        )}

                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                            <p><span className="text-destructive">*</span> {t('createDialog.required')}</p>
                            <p>Student initials will be shown if no avatar is provided.</p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-6 border-t">
                    <div className="flex gap-2 w-full justify-end">
                        {mode === 'edit' && onDelete && student && (
                            <DeleteStudentsDialog
                                selectedStudents={[student]}
                                onDeleteStudents={handleDelete}
                                trigger={
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="hidden sm:inline">{t('editDialog.actions.delete')}</span>
                                        <span className="sm:hidden">{t('actions.deleteShort')}</span>
                                    </Button>
                                }
                            />
                        )}
                        <Button
                            type="submit"
                            className="bg-yankees-blue hover:bg-yankees-blue/90 gap-2"
                        >
                            <SubmitIcon className="h-4 w-4" />
                            {submitButtonText}
                        </Button>
                    </div>
                </DialogFooter>
            </form>
        </DialogContent>
    )

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            {dialogContent}
        </Dialog>
    )
}
