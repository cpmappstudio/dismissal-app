export interface StudentData {
    id: string
    name: string
    grade?: string
    birthday?: string
    imageUrl?: string
}

export interface CarData {
    id: string
    carNumber: number
    lane: 'left' | 'right'
    position: number
    assignedTime: Date
    students: StudentData[] // Updated from studentName to students array
    campus: string
    imageColor: string // Cambio de imageUrl a imageColor
}

export type LaneType = 'left' | 'right'
export type ModeType = 'allocator' | 'dispatcher' | 'viewer'
