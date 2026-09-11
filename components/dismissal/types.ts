import { Id } from "@/convex/_generated/dataModel"

export interface StudentData {
    pickup?: { status: string; vehicleIdentifier?: number | string } | null
    id: string
    name: string
    grade?: string
    birthday?: string
    imageUrl?: string
    avatarStorageId?: Id<"_storage">
}

export interface CarData {
    vehicleType?: 'car' | 'bus'
    timezone?: string
    id: string
    carNumber: number | string
    lane: 'left' | 'right'
    position: number
    assignedTime: Date
    students: StudentData[] // Updated from studentName to students array
    campus: string
    imageColor: string // Cambio de imageUrl a imageColor
}

export type LaneType = 'left' | 'right'
export type ModeType = 'operator' | 'viewer'

// Undefined declines the click synchronously; a promise means the mutation started.
export type RemoveCarHandler = (carId: string) => Promise<void> | undefined
