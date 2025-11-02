"use client"

import * as React from "react"
import { Plus, Upload, X, Loader2, Save, Trash2 } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
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
import { Staff } from "../types"
import { CampusLocation } from "@/convex/types"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { CAMPUS_LOCATIONS } from "@/convex/types"
import { DeleteStaffDialog } from "./delete-staff-dialog"

interface StaffFormDialogProps {
    mode: 'create' | 'edit'
    staff?: Staff
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSubmit: (staff: Omit<Staff, 'id'>) => void
    onDelete?: (staffId: string) => void
}

export function StaffFormDialog({
    mode,
    staff,
    trigger,
    open: controlledOpen,
    onOpenChange,
    onSubmit,
    onDelete
}: StaffFormDialogProps) {
    const t = useTranslations('staffManagement')
    const [internalOpen, setInternalOpen] = React.useState(false)

    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    const initial = React.useMemo(() => {
        if (mode === 'edit' && staff) {
            return {
                firstName: staff.firstName,
                lastName: staff.lastName,
                email: staff.email || "",
                phoneNumber: staff.phoneNumber || "",
                role: staff.role || "",
                campusLocation: staff.campusLocation || "",
                avatarUrl: staff.avatarUrl || "",
                avatarStorageId: staff.avatarStorageId || null,
                status: staff.status || "active",
            }
        }
        return {
            firstName: "",
            lastName: "",
            email: "",
            phoneNumber: "",
            role: "",
            campusLocation: "",
            avatarUrl: "",
            avatarStorageId: null,
            status: "active",
        }
    }, [mode, staff])

    const [formData, setFormData] = React.useState(initial)
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (open) {
            setFormData(initial)
            setAvatarFile(null)
            setAvatarPreview(null)
        }
    }, [open, initial])

    React.useEffect(() => {
        return () => {
            if (avatarPreview) URL.revokeObjectURL(avatarPreview)
        }
    }, [avatarPreview])

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (!f.type.startsWith('image/')) {
            alert('Select an image')
            return
        }
        setAvatarFile(f)
        setAvatarPreview(URL.createObjectURL(f))
    }

    const removeAvatar = () => {
        setAvatarFile(null)
        setAvatarPreview(null)
        setFormData(prev => ({ ...prev, avatarUrl: "", avatarStorageId: null }))
    }

    const update = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.firstName || !formData.lastName || !formData.role || !formData.campusLocation) return

        // For now, we won't upload avatar - just use preview/local URL
        const payload: Omit<Staff, 'id'> = {
            fullName: `${formData.firstName} ${formData.lastName}`,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phoneNumber: formData.phoneNumber,
            role: formData.role,
            campusLocation: formData.campusLocation as CampusLocation,
            status: formData.status,
            avatarUrl: avatarPreview || formData.avatarUrl || "",
            avatarStorageId: undefined,
        }

        onSubmit(payload)
        setOpen(false)
    }

    const isCreate = mode === 'create'
    const dialogTitle = isCreate ? t('createDialog.title') : t('editDialog.title')
    const dialogSubtitle = isCreate ? t('createDialog.subtitle') : t('editDialog.subtitle')
    const submitText = isCreate ? t('createDialog.actions.create') : t('editDialog.actions.save')
    const SubmitIcon = isCreate ? Plus : Save

    const ROLE_OPTIONS = [
        'superadmin', 'admin', 'allocator', 'dispatcher', 'viewer', 'operator'
    ] as const

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="space-y-3">
                        <DialogTitle className="text-xl font-semibold text-center">{dialogTitle}</DialogTitle>
                        <DialogDescription className="text-center text-muted-foreground">{dialogSubtitle}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">{t('createDialog.fields.firstName.label')} <span className="text-destructive">*</span></Label>
                                    <Input value={formData.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder={t('createDialog.fields.firstName.placeholder')} required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">{t('createDialog.fields.lastName.label')} <span className="text-destructive">*</span></Label>
                                    <Input value={formData.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder={t('createDialog.fields.lastName.placeholder')} required />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">{t('createDialog.fields.email.label')}</Label>
                                    <Input value={formData.email} onChange={(e) => update('email', e.target.value)} placeholder={t('createDialog.fields.email.placeholder')} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">{t('createDialog.fields.phone.label')}</Label>
                                    <Input value={formData.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} placeholder={t('createDialog.fields.phone.placeholder')} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">{t('createDialog.fields.role.label')} <span className="text-destructive">*</span></Label>
                                    <Select value={formData.role} onValueChange={(v) => update('role', v)}>
                                        <SelectTrigger className="w-full h-10">
                                            <SelectValue placeholder={t('createDialog.fields.role.placeholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLE_OPTIONS.map(r => (
                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">{t('createDialog.fields.campus.label')} <span className="text-destructive">*</span></Label>
                                    <Select value={formData.campusLocation} onValueChange={(v) => update('campusLocation', v)}>
                                        <SelectTrigger className="w-full h-10">
                                            <SelectValue placeholder={t('createDialog.fields.campus.placeholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CAMPUS_LOCATIONS.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Avatar</Label>
                                        <Avatar className="h-16 w-16">
                                            <AvatarImage src={avatarPreview || formData.avatarUrl || undefined} alt={`${formData.firstName} ${formData.lastName}`} />
                                            <AvatarFallback>{(formData.firstName?.[0] || '') + (formData.lastName?.[0] || '')}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <Label htmlFor="avatar-upload" className="cursor-pointer">
                                                <Button type="button" variant="outline" size="sm" asChild>
                                                    <span><Upload className="h-4 w-4 mr-1"/> Upload</span>
                                                </Button>
                                            </Label>
                                            <Input id="avatar-upload" type="file" accept="image/*" onChange={handleFile} className="hidden" />

                                            {(avatarPreview || formData.avatarUrl) && (
                                                <Button type="button" variant="outline" size="sm" onClick={removeAvatar}><X className="h-4 w-4 mr-1"/> Remove</Button>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{t('createDialog.avatarNote')}</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-6 border-t">
                        <div className="flex gap-2 w-full justify-end">
                            {mode === 'edit' && onDelete && staff && (
                                <DeleteStaffDialog
                                    selectedStaff={[staff]}
                                    onDeleteStaff={(ids: string[]) => onDelete(ids[0])}
                                    trigger={
                                        <Button type="button" variant="destructive" className="gap-2">
                                            <Trash2 className="h-4 w-4" />
                                            <span className="hidden sm:inline">{t('editDialog.actions.delete')}</span>
                                            <span className="sm:hidden">{t('actions.deleteShort')}</span>
                                        </Button>
                                    }
                                />
                            )}
                            <Button type="submit" className="bg-yankees-blue hover:bg-yankees-blue/90 gap-2">
                                <SubmitIcon className="h-4 w-4" />
                                {submitText}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default StaffFormDialog
