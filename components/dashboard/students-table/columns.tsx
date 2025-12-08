"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { useTranslations } from 'next-intl'
import { Student } from "../types"
import { StudentAvatar } from "./student-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

export const useColumns = (): ColumnDef<Student>[] => {
    const t = useTranslations('studentsManagement')

    return [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "fullName",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
                >
                    <span className="hidden sm:inline">{t('table.headers.name')}</span>
                    <span className="sm:hidden">{t('table.headers.name')}</span>
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const student = row.original

                return (
                    <div className="flex items-center space-x-2 min-w-0 sm:space-x-3">
                        <StudentAvatar
                            avatarStorageId={student.avatarStorageId}
                            fallbackUrl={student.avatarUrl}
                            firstName={student.firstName}
                            lastName={student.lastName}
                            size="md"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="font-medium truncate text-sm sm:text-base">{student.fullName}</div>
                            {/* Show grade and campus on mobile under the name */}
                            <div className="text-xs text-muted-foreground sm:hidden">
                                <span className="inline-flex items-center">
                                    <Badge variant="outline" className="mr-1 text-xs">{student.grade}</Badge>
                                    <span className="truncate">{student.campusLocation}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "birthday",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-auto p-0 font-medium hidden sm:flex text-white hover:text-white hover:bg-white/10"
                >
                    Birthday
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground hidden sm:block">
                    {row.getValue("birthday")}
                </div>
            ),
            meta: {
                className: "hidden sm:table-cell"
            }
        },
        {
            accessorKey: "carNumber",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
                >
                    <span className="hidden md:inline">{t('table.headers.carNumber')}</span>
                    <span className="md:hidden">{t('table.headers.carNumber')}</span>
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const carNumber = row.getValue("carNumber") as number
                return (
                    <Badge variant={carNumber === 0 ? "outline" : "secondary"} className="font-mono tracking-wider text-xs">
                        {carNumber === 0 ? "N/A" : carNumber}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "grade",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-auto p-0 font-medium hidden sm:flex text-white hover:text-white hover:bg-white/10"
                >
                    {t('table.headers.grade')}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                    {row.getValue("grade")}
                </Badge>
            ),
            meta: {
                className: "hidden sm:table-cell"
            }
        },
        {
            accessorKey: "campusLocation",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-auto p-0 font-medium hidden lg:flex text-white hover:text-white hover:bg-white/10"
                >
                    {t('table.headers.campus')}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="text-sm hidden lg:block truncate max-w-32">
                    {row.getValue("campusLocation")}
                </div>
            ),
            meta: {
                className: "hidden lg:table-cell"
            }
        },
    ]
}

// Keep the old export for backward compatibility temporarily
export const columns: ColumnDef<Student>[] = []
