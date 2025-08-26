"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
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
import { ChevronDown, Search, GraduationCap, Plus } from "lucide-react"

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
import { columns, useColumns } from "./columns"
import { mockStudents } from "./mock-data"
import { Student, Grade } from "./types"
import { DeleteStudentsDialog } from "./delete-students-dialog"
import { StudentFormDialog } from "./student-form-dialog"
import { CampusSelector, type CampusLocationType as CampusLocation } from "@/components/ui/campus-selector"

const GRADES: readonly Grade[] = [
    "Pre-Kinder", "Kinder", "1st", "2nd", "3rd", "4th", "5th", "6th",
    "7th", "8th", "9th", "10th", "11th", "12th"
] as const

// Optimized responsive text component
const ResponsiveText = React.memo(({
    full, short
}: {
    full: string; short: string
}) => (
    <>
        <span className="hidden lg:inline">{full}</span>
        <span className="lg:hidden">{short}</span>
    </>
))
ResponsiveText.displayName = "ResponsiveText"

// Types for state management
interface FiltersState {
    search: string
    campus: string
    grade: string
}

// Optimized state reducer
const filtersReducer = (state: FiltersState, action: { type: string; payload: string }): FiltersState => {
    switch (action.type) {
        case 'SET_SEARCH': return { ...state, search: action.payload }
        case 'SET_CAMPUS': return { ...state, campus: action.payload }
        case 'SET_GRADE': return { ...state, grade: action.payload }
        case 'RESET': return { search: '', campus: 'all', grade: 'all' }
        default: return state
    }
}

export function StudentsTable() {
    const t = useTranslations('studentsManagement')
    const columns = useColumns()

    // Optimized state management
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [rowSelection, setRowSelection] = React.useState({})
    const [studentsData, setStudentsData] = React.useState<Student[]>(mockStudents)

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = React.useState(false)
    const [selectedStudent, setSelectedStudent] = React.useState<Student | undefined>(undefined)

    // Single reducer for all filters
    const [filters, dispatchFilters] = React.useReducer(filtersReducer, {
        search: '',
        campus: 'all',
        grade: 'all'
    })

    // Optimized data filtering using React Table's built-in system
    const processedData = React.useMemo(() => {
        let data = studentsData

        // Apply custom filters before React Table
        if (filters.campus !== 'all') {
            data = data.filter(student => student.campusLocation === filters.campus)
        }
        if (filters.grade !== 'all') {
            data = data.filter(student => student.grade === filters.grade)
        }

        return data
    }, [studentsData, filters.campus, filters.grade])

    // Table configuration - properly memoized
    const table = useReactTable({
        data: processedData,
        columns,
        state: { sorting, columnFilters, rowSelection },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    // Optimized selected students - fixed dependencies
    const selectedStudents = React.useMemo(() => {
        return table.getSelectedRowModel().rows.map(row => row.original)
    }, [table.getSelectedRowModel().rows])

    // Optimized event handlers with single updates
    const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        dispatchFilters({ type: 'SET_SEARCH', payload: value })
        table.getColumn("fullName")?.setFilterValue(value)
    }, [table])

    const handleCampusChange = React.useCallback((value: string) => {
        dispatchFilters({ type: 'SET_CAMPUS', payload: value })
    }, [])

    const handleGradeChange = React.useCallback((value: string) => {
        dispatchFilters({ type: 'SET_GRADE', payload: value })
    }, [])

    const handleDeleteStudents = React.useCallback((studentIds: string[]) => {
        setStudentsData(prev => prev.filter(student => !studentIds.includes(student.id)))
        setRowSelection({})
    }, [])

    const handleCreateStudent = React.useCallback((studentData: Omit<Student, 'id'>) => {
        const newStudent: Student = {
            ...studentData,
            id: `student-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        }
        setStudentsData(prev => [newStudent, ...prev])
    }, [])

    const handleUpdateStudent = React.useCallback((studentData: Omit<Student, 'id'>) => {
        if (selectedStudent) {
            const updatedStudent: Student = {
                ...studentData,
                id: selectedStudent.id
            }
            setStudentsData(prev => prev.map(student =>
                student.id === selectedStudent.id ? updatedStudent : student
            ))
        }
    }, [selectedStudent])

    const handleDeleteStudent = React.useCallback((studentId: string) => {
        setStudentsData(prev => prev.filter(student => student.id !== studentId))
    }, [])

    const handleRowClick = React.useCallback((student: Student, event: React.MouseEvent) => {
        // Don't open edit dialog if clicking on checkbox
        const target = event.target as HTMLElement
        if (target.closest('[role="checkbox"]') || target.closest('input[type="checkbox"]')) {
            return
        }

        setSelectedStudent(student)
        setEditDialogOpen(true)
    }, [])

    // Memoized styles
    const filterButtonClass = React.useMemo(() =>
        "w-full justify-between border-2 border-yankees-blue hover:bg-yankees-blue/10 md:w-auto", [])

    return (
        <div className="w-full">
            <div className="py-4">
                <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center md:justify-between md:gap-4">
                    {/* Optimized search */}
                    <div className="relative col-span-2 md:col-span-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder={t('search.placeholder')}
                            value={(table.getColumn("fullName")?.getFilterValue() as string) ?? ""}
                            onChange={handleSearchChange}
                            className="w-full pl-8 border-2 border-yankees-blue focus:ring-yankees-blue"
                            aria-label={t('search.placeholder')}
                        />
                    </div>

                    {/* Campus filter */}
                    <CampusSelector
                        value={filters.campus}
                        onChange={handleCampusChange}
                        placeholder={t('filters.campus.all')}
                    />

                    {/* Grade filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={filterButtonClass} aria-label="Filter by grade">
                                <div className="flex items-center">
                                    <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
                                    <ResponsiveText
                                        full={filters.grade === "all" ? t('filters.grade.all') : filters.grade}
                                        short={filters.grade === "all" ? t('filters.grade.short') : filters.grade}
                                    />
                                </div>
                                <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel>{t('filters.grade.label')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleGradeChange("all")}>
                                {t('filters.grade.all')}
                            </DropdownMenuItem>
                            {GRADES.map((grade) => (
                                <DropdownMenuItem key={grade} onClick={() => handleGradeChange(grade)}>
                                    {grade}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Action buttons */}
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
            <div className="overflow-x-auto rounded-md border-2 border-yankees-blue">
                <Table>
                    <TableHeader className="bg-yankees-blue">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-b-2 border-yankees-blue hover:bg-yankees-blue">
                                {headerGroup.headers.map((header) => {
                                    const columnMeta = header.column.columnDef.meta as { className?: string } | undefined
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={`whitespace-nowrap px-2 py-3 lg:px-4 text-white ${columnMeta?.className || ''}`}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="hover:bg-muted/50 cursor-pointer border-b border-yankees-blue/20"
                                    onClick={(e) => handleRowClick(row.original, e)}
                                >
                                    {row.getVisibleCells().map((cell) => {
                                        const columnMeta = cell.column.columnDef.meta as { className?: string } | undefined
                                        return (
                                            <TableCell
                                                key={cell.id}
                                                className={`px-2 py-3 lg:px-4 ${columnMeta?.className || ''}`}
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        )
                                    })}
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
            <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-muted-foreground" role="status">
                    <ResponsiveText
                        full={t('table.pagination.selected', {
                            selected: table.getFilteredSelectedRowModel().rows.length,
                            total: table.getFilteredRowModel().rows.length
                        })}
                        short={t('table.pagination.selectedShort', {
                            selected: table.getFilteredSelectedRowModel().rows.length,
                            total: table.getFilteredRowModel().rows.length
                        })}
                    />
                </div>

                <div className="flex justify-center gap-2 lg:justify-end" role="navigation" aria-label="Table pagination">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="flex-1 lg:flex-none"
                        aria-label={t('table.pagination.previous')}
                    >
                        <ResponsiveText full={t('table.pagination.previous')} short={t('table.pagination.previousShort')} />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="flex-1 lg:flex-none"
                        aria-label={t('table.pagination.next')}
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
