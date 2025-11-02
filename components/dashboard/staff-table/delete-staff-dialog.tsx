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

    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = onOpenChange || setInternalOpen

    const handleDelete = () => {
        const ids = selectedStaff.map(s => s.id)
        onDeleteStaff(ids)
        setOpen(false)
    }

    const count = selectedStaff.length
    const isMultiple = count > 1
    const hasSelection = count > 0
    const isDisabled = disabled || !hasSelection

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger ? (
                <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button variant="destructive" disabled={isDisabled} className="w-full gap-2 md:w-auto">
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden lg:inline">{t('actions.delete')}</span>
                        <span className="lg:hidden">{t('actions.deleteShort')}</span>
                    </Button>
                </DialogTrigger>
            )}

            {hasSelection && (
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{isMultiple ? t('deleteDialog.titlePlural') : t('deleteDialog.title')}</DialogTitle>
                        <DialogDescription>{t('deleteDialog.description', { count })}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="max-h-48 overflow-y-auto rounded-md border p-3">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">{t('deleteDialog.listTitle')}</p>
                                <ul className="space-y-1">
                                    {selectedStaff.map(s => (
                                        <li key={s.id} className="text-sm text-muted-foreground truncate">• {s.fullName} ({s.role})</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="destructive" onClick={handleDelete} className="gap-2">
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
