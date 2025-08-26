"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface AlertDialogProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
}

interface AlertDialogContentProps {
    children: React.ReactNode
    className?: string
}

interface AlertDialogActionProps {
    children: React.ReactNode
    onClick?: () => void
    className?: string
}

interface AlertDialogCancelProps {
    children: React.ReactNode
    onClick?: () => void
    className?: string
}

const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
    </Dialog>
)

const AlertDialogTrigger = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
)

const AlertDialogContent = ({ children, className }: AlertDialogContentProps) => (
    <DialogContent className={className}>
        {children}
    </DialogContent>
)

const AlertDialogHeader = DialogHeader
const AlertDialogFooter = DialogFooter
const AlertDialogTitle = DialogTitle
const AlertDialogDescription = DialogDescription

const AlertDialogAction = ({ children, onClick, className }: AlertDialogActionProps) => (
    <Button onClick={onClick} className={className}>
        {children}
    </Button>
)

const AlertDialogCancel = ({ children, onClick, className }: AlertDialogCancelProps) => (
    <Button variant="outline" onClick={onClick} className={className}>
        {children}
    </Button>
)

export {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
}
