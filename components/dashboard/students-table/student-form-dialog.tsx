"use client"

import * as React from "react"
import { Plus, CalendarIcon, Trash2, Save } from "lucide-react"
import { format } from "date-fns"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogClose,
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
import { Student, Grade } from "./types"
import { CampusSelector, CAMPUS_LOCATIONS, type CampusLocationType as CampusLocation } from "@/components/ui/campus-selector"
import { DeleteStudentsDialog } from "./delete-students-dialog"

interface StudentFormDialogProps {
    mode: 'create' | 'edit'
    student?: Student
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSubmit: (student: Omit<Student, 'id'>) => void
    onDelete?: (studentId: string) => void
}

const campusLocations: CampusLocation[] = [
    "Poinciana Campus",
    "Simpson Campus",
    "Neptune Campus",
    "Downtown Middle",
    "Learning Center",
    "Honduras",
    "Puerto Rico"
]

const grades: Grade[] = [
    "Pre-Kinder",
    "Kinder",
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th"
]

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
                campusLocation: student.campusLocation,
                avatarUrl: student.avatarUrl || ""
            }
        }
        return {
            firstName: "",
            lastName: "",
            carNumber: "",
            grade: "" as Grade | "",
            campusLocation: "" as CampusLocation | "",
            avatarUrl: ""
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
        }
    }, [open, initialFormData, mode, student])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.firstName || !formData.lastName || !date || !formData.grade || !formData.campusLocation) {
            return // Basic validation
        }

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
            campusLocation: formData.campusLocation as CampusLocation,
            avatarUrl: formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.firstName}${formData.lastName}`
        }

        onSubmit(studentData)
        setOpen(false)
    }

    const handleDelete = (studentIds: string[]) => {
        if (onDelete && studentIds.length > 0) {
            onDelete(studentIds[0]) // Solo necesitamos el primer ID ya que es un solo estudiante
            setOpen(false)
        }
    }

    const updateFormData = (field: string, value: string) => {
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
                                        {grades.map((grade) => (
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
                                <Select value={formData.campusLocation} onValueChange={(value) => updateFormData("campusLocation", value)}>
                                    <SelectTrigger className="w-full h-10">
                                        <SelectValue placeholder={t('createDialog.fields.campus.placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {campusLocations.map((campus) => (
                                            <SelectItem key={campus} value={campus}>
                                                {campus}
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

                        <div className="grid grid-cols-2 gap-4">
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
                            <div className="space-y-2">
                                <Label htmlFor="avatarUrl" className="text-sm font-medium">{t('createDialog.fields.avatarUrl.label')}</Label>
                                <Input
                                    id="avatarUrl"
                                    value={formData.avatarUrl}
                                    onChange={(e) => updateFormData("avatarUrl", e.target.value)}
                                    placeholder="https://example.com/avatar.jpg"
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                            <p><span className="text-destructive">*</span> {t('createDialog.required')}</p>
                            <p>{t('createDialog.avatarNote')}</p>
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
