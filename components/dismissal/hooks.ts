import { useState, useEffect, useRef, useCallback } from 'react'
import { CarData } from './types'
import { ANIMATION_DURATIONS } from './constants'

interface UseCarAnimationsReturn {
    removingCarId: string | null
    newCarIds: Set<string>
    handleRemoveCar: (carId: string, onRemove: (carId: string) => void) => void
}

export function useCarAnimations(cars: CarData[]): UseCarAnimationsReturn {
    const [removingCarId, setRemovingCarId] = useState<string | null>(null)
    const [newCarIds, setNewCarIds] = useState<Set<string>>(new Set())
    const prevCarsRef = useRef<CarData[]>([])

    // Track new cars for entrance animation
    useEffect(() => {
        const prevCarIds = new Set(prevCarsRef.current.map(car => car.id))

        // Find newly added cars
        const newIds = cars.filter(car => !prevCarIds.has(car.id)).map(car => car.id)

        if (newIds.length > 0) {
            setNewCarIds(new Set(newIds))
            // Remove the new car flag after animation completes
            const timeout = setTimeout(() => {
                setNewCarIds(new Set())
            }, ANIMATION_DURATIONS.ENTRANCE)

            return () => clearTimeout(timeout)
        }

        prevCarsRef.current = cars
    }, [cars])

    const handleRemoveCar = useCallback((carId: string, onRemove: (carId: string) => void) => {
        setRemovingCarId(carId)
        // Wait for animation to complete before actually removing
        setTimeout(() => {
            onRemove(carId)
            setRemovingCarId(null)
        }, ANIMATION_DURATIONS.EXIT)
    }, [])

    return {
        removingCarId,
        newCarIds,
        handleRemoveCar
    }
}
