import { Grade } from "@/convex/types"
import { Id } from "@/convex/_generated/dataModel"

export type Student = {
    id: string
    fullName: string
    firstName: string
    lastName: string
    birthday: string
    carNumber: number
    grade: Grade
    campusId: Id<"campusSettings"> // Campus ID for database operations
    campusLocation: string // Campus name for display (derived from campusId)
    avatarUrl?: string
    avatarStorageId?: Id<"_storage">
}

export type Staff = {
    id: string // clerkId for external use
    convexId?: Id<"users"> // Internal Convex ID for mutations
    fullName: string
    firstName: string
    lastName: string
    email: string
    phoneNumber: string
    role: string
    assignedCampuses: string[] // Array of campus names for display
    status: string
    avatarUrl?: string
    avatarStorageId?: Id<"_storage">
}

// Re-export types for convenience
export type { Grade }
