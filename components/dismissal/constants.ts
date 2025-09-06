// Constantes para evitar recreación en cada render
import { CAR_COLORS } from "@/convex/types"

export { CAR_COLORS }

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

export const ANIMATION_DURATIONS = {
    ENTRANCE: 500,
    EXIT: 600, // Reduced from 800 to 600 for faster but still smooth animation
    REPOSITION: 300
} as const
