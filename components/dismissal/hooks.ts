import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
    const prevCarIdsRef = useRef<Set<string>>(new Set())
    const isInitializedRef = useRef(false)

    // Create stable dependency for car IDs
    const carIds = useMemo(() => cars.map(car => car.id).sort().join(','), [cars])

    // Initialize the ref on first render to avoid false positives for new cars
    useEffect(() => {
        if (!isInitializedRef.current) {
            prevCarIdsRef.current = new Set(cars.map(car => car.id))
            isInitializedRef.current = true
        }
    }, []) // Run only once on mount

    // Track new cars for entrance animation - Optimized to only track car IDs
    useEffect(() => {
        // Skip the effect if we haven't initialized yet
        if (!isInitializedRef.current) return

        const currentCarIds = new Set(cars.map(car => car.id))
        const prevCarIds = prevCarIdsRef.current

        // Find newly added cars by comparing ID sets
        const newIds = cars
            .filter(car => !prevCarIds.has(car.id))
            .map(car => car.id)

        if (newIds.length > 0) {
            setNewCarIds(new Set(newIds))
            // Remove the new car flag after animation completes
            const timeout = setTimeout(() => {
                setNewCarIds(new Set())
            }, ANIMATION_DURATIONS.ENTRANCE)

            // Update the ref with current IDs
            prevCarIdsRef.current = currentCarIds

            return () => clearTimeout(timeout)
        } else {
            // Update the ref even if no new cars were added
            prevCarIdsRef.current = currentCarIds
        }
    }, [carIds]) // Only re-run when car IDs change

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
