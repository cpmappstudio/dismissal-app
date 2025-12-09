// hooks/use-students-data.ts

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Grade } from "@/convex/types"
import type { Id } from "@/convex/_generated/dataModel"

interface StudentFilters {
    search?: string
    campus?: string
    grade?: Grade
    limit?: number
    offset?: number
    carNumber?: number
    hasCarAssigned?: boolean
}

/**
 * Hook personalizado para obtener datos de estudiantes con filtros
 * Encapsula la lógica de query y proporciona una API limpia
 */
export function useStudentsData(filters: StudentFilters) {
    return useQuery(api.students.list, {
        search: filters.search || undefined,
        campus: filters.campus || undefined,
        grade: filters.grade || undefined,
        limit: filters.limit || 10000, // Límite muy alto por defecto para obtener todos
        offset: filters.offset || undefined,
        carNumber: filters.carNumber || undefined,
        hasCarAssigned: filters.hasCarAssigned || undefined,
    })
}

/**
 * Hook para obtener estudiantes por número de carro
 */
export function useStudentsByCarNumber(carNumber: number, campusId: Id<"campusSettings">) {
    return useQuery(api.students.getByCarNumber, {
        carNumber,
        campusId
    })
}

export type { StudentFilters }
