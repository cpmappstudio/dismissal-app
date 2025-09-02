// Constantes para evitar recreación en cada render
export const LANE_COLORS = {
    left: {
        primary: 'text-blue-600',
        background: 'bg-blue-100',
        textColor: 'text-blue-600',
        badge: 'bg-blue-500',
        iconColor: 'text-blue-400',
        carColor: '#3b82f6'
    },
    right: {
        primary: 'text-green-600',
        background: 'bg-green-100',
        textColor: 'text-green-600',
        badge: 'bg-green-500',
        iconColor: 'text-green-400',
        carColor: '#10b981'
    }
} as const

export const CAR_COLORS = [
    '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
    '#f97316', '#06b6d4', '#84cc16', '#f59e0b'
] as const

export const ANIMATION_DURATIONS = {
    ENTRANCE: 500,
    EXIT: 300,
    REPOSITION: 300
} as const
