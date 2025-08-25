/**
 * Program data transformation utilities
 * 
 * This file contains helper functions for transforming and formatting
 * program-related data across the application.
 */

import type { ProgramType, Language } from '@/convex/types'

/**
 * Get program name based on locale preference
 */
export const getProgramName = (
    nameEs: string,
    nameEn: string | undefined,
    locale: string
): string => {
    // If only Spanish name exists, use it
    if (!nameEn) return nameEs

    // If only English name exists, use it  
    if (!nameEs) return nameEn

    // If both exist, use based on locale
    return locale === 'en' ? nameEn : nameEs
}

/**
 * Get localized label for program type
 */
export const getProgramTypeLabel = (type: ProgramType): string => {
    switch (type) {
        case "diploma": return "Diploma"
        case "bachelor": return "Pregrado"
        case "master": return "Maestría"
        case "doctorate": return "Doctorado"
        default: return "Programa"
    }
}

/**
 * Get array of language labels for a program
 */
export const getProgramLanguages = (language: Language): string[] => {
    switch (language) {
        case "es": return ["Español"]
        case "en": return ["Inglés"]
        case "both": return ["Español", "Inglés"]
        default: return ["Español"]
    }
}

/**
 * Format enrollment date timestamp to readable string
 */
export const formatEnrollmentDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long'
    })
}
