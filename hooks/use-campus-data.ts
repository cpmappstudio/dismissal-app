// hooks/use-campus-data.ts

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

interface CampusFilters {
    isActive?: boolean
    status?: "active" | "inactive" | "maintenance"
}

/**
 * Hook personalizado para obtener todos los campus con filtros
 * Encapsula la lógica de query y proporciona una API limpia
 */
export function useCampusData(filters?: CampusFilters) {
    return useQuery(api.campus.getAll, {
        isActive: filters?.isActive,
        status: filters?.status,
    })
}

/**
 * Hook para obtener campus activos
 */
export function useActiveCampuses() {
    return useQuery(api.campus.listActive)
}

/**
 * Hook para obtener un campus por nombre
 */
export function useCampusByName(campusName: string) {
    return useQuery(api.campus.get, { campusName })
}

/**
 * Hook para obtener un campus por ID
 */
export function useCampusById(campusId: Id<"campusSettings">) {
    return useQuery(api.campus.getById, { campusId })
}

/**
 * Hook para obtener estadísticas de un campus
 */
export function useCampusStats(campusId: Id<"campusSettings">) {
    return useQuery(api.campus.getStats, { campusId })
}

/**
 * Hook para obtener opciones de campus para dropdowns
 */
export function useCampusOptions() {
    return useQuery(api.campus.getOptions)
}

export type { CampusFilters }
