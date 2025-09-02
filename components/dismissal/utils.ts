import { CarData } from './types'

// Funciones helper memoizadas fuera del componente
export const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const getStudentInitials = (name: string): string => {
    return name.split(' ').map((n: string) => n[0]).join('')
}

export const getDisplayName = (students: CarData['students']): string => {
    if (students.length === 1) {
        return students[0].name
    }
    if (students.length === 2) {
        return `${students[0].name} y ${students[1].name}`
    }
    return `${students[0].name} +${students.length - 1} más`
}

export const getCarColor = (carNumber: number): string => {
    const colors = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16', '#f59e0b']
    return colors[carNumber % colors.length]
}

export const getConsistentTime = (carNumber: number): Date => {
    const baseTime = new Date('2024-01-01T09:00:00')
    baseTime.setMinutes(baseTime.getMinutes() + (carNumber % 30))
    return baseTime
}
