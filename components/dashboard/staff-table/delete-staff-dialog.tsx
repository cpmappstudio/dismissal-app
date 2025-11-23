"use client"

import * as React from "react"
import { Trash2, TriangleAlert } from "lucide-react"
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
import { Staff } from "../types"

interface DeleteStaffDialogProps {
    selectedStaff: Staff[]
    onDeleteStaff: (staffIds: string[]) => void
    disabled?: boolean
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function DeleteStaffDialog({
    selectedStaff,
    onDeleteStaff,
    disabled = false,
    trigger,
    open: controlledOpen,
    onOpenChange
}: DeleteStaffDialogProps) {
    const t = useTranslations('staffManagement')
    const [internalOpen, setInternalOpen] = React.useState(false)

    // Use controlled or internal state
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    // Separate superadmin and deletable staff
    const superadminStaff = React.useMemo(
        () => selectedStaff.filter(staff => staff.role === "superadmin"),
        [selectedStaff]
    )
    const deletableStaff = React.useMemo(
        () => selectedStaff.filter(staff => staff.role !== "superadmin"),
        [selectedStaff]
    )

    const handleDelete = () => {
        const staffIds = deletableStaff.map(staff => staff.id)
        if (staffIds.length > 0) {
            onDeleteStaff(staffIds)
        }
        setOpen(false)
    }

    const staffCount = selectedStaff.length
    const deletableCount = deletableStaff.length
    const superadminCount = superadminStaff.length
    const isMultiple = deletableCount > 1
    const hasSelection = staffCount > 0
    const hasDeletableStaff = deletableCount > 0
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
                            {hasDeletableStaff 
                                ? t('deleteDialog.description', { count: deletableCount })
                                : t('deleteDialog.noDeletableStaff')
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        {/* Warning for superadmin users */}
                        {superadminCount > 0 && (
                            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                        {t('deleteDialog.superadminWarning.title')}
                                    </p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                        {t('deleteDialog.superadminWarning.description', { count: superadminCount })}
                                    </p>
                                    <ul className="space-y-1">
                                        {superadminStaff.map((staff) => (
                                            <li key={staff.id} className="text-sm text-amber-700 dark:text-amber-300 truncate">
                                                • {staff.fullName} ({staff.role})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* List of deletable staff */}
                        {hasDeletableStaff && (
                            <div className="max-h-48 overflow-y-auto rounded-md border p-3">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">{t('deleteDialog.listTitle')}</p>
                                    <ul className="space-y-1">
                                        {deletableStaff.map((staff) => (
                                            <li key={staff.id} className="text-sm text-muted-foreground truncate">
                                                • {staff.fullName} ({staff.role})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={!hasDeletableStaff}
                            className="gap-2"
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

export default DeleteStaffDialog