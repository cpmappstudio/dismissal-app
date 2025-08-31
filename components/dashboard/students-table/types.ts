import { Grade, CampusLocation } from "@/lib/constants"

export type Student = {
    id: string
    fullName: string
    firstName: string
    lastName: string
    birthday: string
    carNumber: number
    grade: Grade
    campusLocation: CampusLocation
    avatarUrl?: string
}

// Re-export types for convenience
export type { Grade, CampusLocation }
