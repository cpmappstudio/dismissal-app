// hooks/use-students-data.ts

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Grade, CampusLocation } from "@/convex/types"

interface StudentFilters {
    search?: string
    campus?: CampusLocation
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
        limit: filters.limit || 100,
        offset: filters.offset || undefined,
        carNumber: filters.carNumber || undefined,
        hasCarAssigned: filters.hasCarAssigned || undefined,
    })
}

/**
 * Hook para obtener estudiantes por número de carro
 */
export function useStudentsByCarNumber(carNumber: number, campus: CampusLocation) {
    return useQuery(api.students.getByCarNumber, {
        carNumber,
        campus
    })
}

export type { StudentFilters }
