"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Search, GraduationCap, Plus, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useColumns } from "./columns"
import { Student } from "./types"
import { DeleteStudentsDialog } from "./delete-students-dialog"
import { StudentFormDialog } from "./student-form-dialog"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { CAMPUS_LOCATIONS, GRADES, Grade, CampusLocation, Id } from "@/convex/types"


export function StudentsTable() {
    const t = useTranslations('studentsManagement')
    const columns = useColumns()

    // Table state
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [rowSelection, setRowSelection] = React.useState({})

    // Filter state for Convex queries
    const [searchFilter, setSearchFilter] = React.useState("")
    const [campusFilter, setCampusFilter] = React.useState<CampusLocation | "">("")
    const [gradeFilter, setGradeFilter] = React.useState<Grade | "">("")

    // Dialog state
    const [editDialogOpen, setEditDialogOpen] = React.useState(false)
    const [selectedStudent, setSelectedStudent] = React.useState<Student | undefined>()

    // Convex hooks
    const studentsData = useQuery(api.students.list, {
        search: searchFilter || undefined,
        campus: campusFilter || undefined,
        grade: gradeFilter || undefined,
        limit: 100,
    })

    const createStudentMutation = useMutation(api.students.create)
    const updateStudentMutation = useMutation(api.students.update)
    const deleteStudentMutation = useMutation(api.students.deleteStudent)

    // Transform Convex data to match component expectations
    const data: Student[] = React.useMemo(() => {
        if (!studentsData?.students) return []

        return studentsData.students.map((student: any) => ({
            id: student._id,
            fullName: student.fullName,
            firstName: student.firstName,
            lastName: student.lastName,
            birthday: student.birthday,
            carNumber: student.carNumber,
            grade: student.grade as Grade,
            campusLocation: student.campusLocation,
            avatarUrl: student.avatarUrl || "",
        }))
    }, [studentsData])

    // Loading state
    const isLoading = studentsData === undefined

    // Table instance
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            rowSelection,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    // Update filters when table filters change
    React.useEffect(() => {
        const searchValue = table.getColumn("fullName")?.getFilterValue() as string
        setSearchFilter(searchValue || "")
    }, [table.getColumn("fullName")?.getFilterValue()])

    React.useEffect(() => {
        const campusValue = table.getColumn("campusLocation")?.getFilterValue() as CampusLocation
        setCampusFilter(campusValue || "")
    }, [table.getColumn("campusLocation")?.getFilterValue()])

    React.useEffect(() => {
        const gradeValue = table.getColumn("grade")?.getFilterValue() as Grade
        setGradeFilter(gradeValue || "")
    }, [table.getColumn("grade")?.getFilterValue()])

    // Get selected students
    const selectedStudents = table.getFilteredSelectedRowModel().rows.map(row => row.original)

    // Handlers
    const handleDeleteStudents = async (studentIds: string[]) => {
        try {
            for (const id of studentIds) {
                await deleteStudentMutation({ studentId: id as Id<"students"> })
            }
            setRowSelection({})
        } catch (error) {
            console.error("Error deleting students:", error)
        }
    }

    const handleCreateStudent = async (studentData: Omit<Student, 'id'>) => {
        try {
            await createStudentMutation({
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                grade: studentData.grade,
                campusLocation: studentData.campusLocation,
                birthday: studentData.birthday,
                carNumber: studentData.carNumber,
                avatarUrl: studentData.avatarUrl,
            })
        } catch (error) {
            console.error("Error creating student:", error)
        }
    }

    const handleUpdateStudent = async (studentData: Omit<Student, 'id'>) => {
        if (!selectedStudent) return

        try {
            await updateStudentMutation({
                studentId: selectedStudent.id as Id<"students">,
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                grade: studentData.grade,
                campusLocation: studentData.campusLocation,
                birthday: studentData.birthday,
                carNumber: studentData.carNumber,
                avatarUrl: studentData.avatarUrl,
            })
            setEditDialogOpen(false)
            setSelectedStudent(undefined)
        } catch (error) {
            console.error("Error updating student:", error)
        }
    }

    const handleDeleteStudent = async (studentId: string) => {
        try {
            await deleteStudentMutation({ studentId: studentId as Id<"students"> })
            setEditDialogOpen(false)
            setSelectedStudent(undefined)
        } catch (error) {
            console.error("Error deleting student:", error)
        }
    }

    const handleRowClick = (student: Student, event: React.MouseEvent) => {
        // Skip if clicking checkbox
        if ((event.target as HTMLElement).closest('[role="checkbox"]')) return

        setSelectedStudent(student)
        setEditDialogOpen(true)
    }

    if (isLoading) {
        return (
            <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-[200px]" />
                    <Skeleton className="h-8 w-[100px]" />
                </div>
                <div className="rounded-md border">
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Filters */}
            <div className="py-4 pt-0">
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-between md:gap-4">
                    {/* Search */}
                    <div className="relative col-span-2 md:col-span-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder={t('search.placeholder')}
                            value={(table.getColumn("fullName")?.getFilterValue() as string) ?? ""}
                            onChange={(e) =>
                                table.getColumn("fullName")?.setFilterValue(e.target.value)
                            }
                            className="pl-8 border-2 border-yankees-blue focus:ring-yankees-blue"
                            aria-label={t('search.placeholder')}
                        />
                    </div>

                    {/* Campus filter */}
                    <FilterDropdown<typeof CAMPUS_LOCATIONS[number]>
                        value={(table.getColumn("campusLocation")?.getFilterValue() as typeof CAMPUS_LOCATIONS[number]) ?? ""}
                        onChange={(value: string) =>
                            table.getColumn("campusLocation")?.setFilterValue(value)
                        }
                        options={CAMPUS_LOCATIONS}
                        icon={MapPin}
                        label={t('filters.campus.label')}
                        placeholder={t('filters.campus.all')}
                        placeholderShort={t('filters.campus.short')}
                    />

                    {/* Grade filter */}
                    <FilterDropdown<Grade>
                        value={(table.getColumn("grade")?.getFilterValue() as Grade) ?? ""}
                        onChange={(value: string) =>
                            table.getColumn("grade")?.setFilterValue(value)
                        }
                        options={GRADES}
                        icon={GraduationCap}
                        label={t('filters.grade.label')}
                        placeholder={t('filters.grade.all')}
                        placeholderShort={t('filters.grade.short')}
                    />

                    {/* Actions */}
                    <div className="col-span-2 flex gap-2 md:col-span-1 md:ml-auto">
                        <div className="flex-1 md:flex-none">
                            <StudentFormDialog
                                mode="create"
                                onSubmit={handleCreateStudent}
                                trigger={
                                    <Button className="w-full gap-2 bg-yankees-blue hover:bg-yankees-blue/90 md:w-auto">
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden lg:inline">{t('actions.add')}</span>
                                        <span className="lg:hidden">{t('actions.addShort')}</span>
                                    </Button>
                                }
                            />
                        </div>
                        <div className="flex-1 md:flex-none">
                            <DeleteStudentsDialog
                                selectedStudents={selectedStudents}
                                onDeleteStudents={handleDeleteStudents}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-md border-2 border-yankees-blue">
                <Table>
                    <TableHeader className="bg-yankees-blue">
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id} className="border-b-2 border-yankees-blue hover:bg-yankees-blue">
                                {headerGroup.headers.map(header => (
                                    <TableHead
                                        key={header.id}
                                        className={`whitespace-nowrap px-2 py-3 text-white lg:px-4 ${(header.column.columnDef.meta as any)?.className || ''
                                            }`}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map(row => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="cursor-pointer border-b border-yankees-blue/20 hover:bg-muted/50"
                                    onClick={(e) => handleRowClick(row.original, e)}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell
                                            key={cell.id}
                                            className={`px-2 py-3 lg:px-4 ${(cell.column.columnDef.meta as any)?.className || ''
                                                }`}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {t('table.noResults')}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between py-4">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="hidden sm:inline">{t('table.pagination.previous')}</span>
                        <span className="sm:hidden">{t('table.pagination.previousShort')}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {t('table.pagination.next')}
                    </Button>
                </div>
            </div>

            {/* Edit Dialog */}
            <StudentFormDialog
                mode="edit"
                student={selectedStudent}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSubmit={handleUpdateStudent}
                onDelete={handleDeleteStudent}
            />
        </div>
    )
}
