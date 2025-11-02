import { Grade, CampusLocation } from "@/convex/types"
import { Id } from "@/convex/_generated/dataModel"

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
    avatarStorageId?: Id<"_storage">
}

export type Staff = {
    id: string
    fullName: string
    firstName: string
    lastName: string
    email: string
    phoneNumber: string
    role: string
    campusLocation: CampusLocation
    status: string
    avatarUrl?: string
    avatarStorageId?: Id<"_storage">
}

// Re-export types for convenience
export type { Grade, CampusLocation }
