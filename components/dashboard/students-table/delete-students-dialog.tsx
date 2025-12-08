"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Student } from "../types"

interface DeleteStudentsDialogProps {
    selectedStudents: Student[]
    onDeleteStudents: (studentIds: string[]) => void
    disabled?: boolean
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function DeleteStudentsDialog({
    selectedStudents,
    onDeleteStudents,
    disabled = false,
    trigger,
    open: controlledOpen,
    onOpenChange
}: DeleteStudentsDialogProps) {
    const t = useTranslations('studentsManagement')
    const [internalOpen, setInternalOpen] = React.useState(false)

    // Use controlled or internal state
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    const handleDelete = () => {
        const studentIds = selectedStudents.map(student => student.id)
        onDeleteStudents(studentIds)
        setOpen(false)
    }

    const studentCount = selectedStudents.length
    const isMultiple = studentCount > 1
    const hasSelection = studentCount > 0
    const isDisabled = disabled || !hasSelection

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger ? (
                <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button
                        variant="destructive"
                        disabled={isDisabled}
                        className="w-full gap-2 md:w-auto"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden lg:inline">{t('actions.delete')}</span>
                        <span className="lg:hidden">{t('actions.deleteShort')}</span>
                    </Button>
                </DialogTrigger>
            )}
            {hasSelection && (
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {isMultiple ? t('deleteDialog.titlePlural') : t('deleteDialog.title')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('deleteDialog.description', { count: studentCount })}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="max-h-48 overflow-y-auto rounded-md border p-3">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">{t('deleteDialog.listTitle')}</p>
                                <ul className="space-y-1">
                                    {selectedStudents.map((student) => (
                                        <li key={student.id} className="text-sm text-muted-foreground truncate">
                                            • {student.fullName} ({student.grade})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            className="gap-2 "
                        >
                            <Trash2 className="h-4 w-4" />
                            {isMultiple ? t('deleteDialog.actions.deletePlural') : t('deleteDialog.actions.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            )}
        </Dialog>
    )
}
