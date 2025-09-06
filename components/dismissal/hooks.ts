import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { CarData } from './types'
import { ANIMATION_DURATIONS } from './constants'

interface UseCarAnimationsReturn {
    removingCarId: string | null
    newCarIds: Set<string>
    handleRemoveCar: (carId: string, onRemove: (carId: string) => void) => void
    isCarRemoving: (carId: string) => boolean
}

export function useCarAnimations(cars: CarData[]): UseCarAnimationsReturn {
    const [removingCarId, setRemovingCarId] = useState<string | null>(null)
    const [newCarIds, setNewCarIds] = useState<Set<string>>(new Set())
    const [removingCars, setRemovingCars] = useState<Set<string>>(new Set())
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
    }, [cars]) // Include cars dependency

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
    }, [carIds, cars]) // Include cars dependency

    // Clean up removing cars when they're actually removed from the data
    useEffect(() => {
        const currentCarIds = new Set(cars.map(car => car.id))
        setRemovingCars(prev => {
            const stillRemoving = new Set<string>()
            for (const carId of prev) {
                // Keep the car in removing state if it still exists in data
                if (currentCarIds.has(carId)) {
                    stillRemoving.add(carId)
                }
            }
            return stillRemoving
        })
    }, [cars])

    const handleRemoveCar = useCallback((carId: string, onRemove: (carId: string) => void) => {
        // Immediately mark as removing and start animation
        setRemovingCarId(carId)
        setRemovingCars(prev => new Set(prev).add(carId))

        // Call onRemove after a short delay (about 1/3 of animation duration)
        // This allows the animation to start but updates Convex quickly
        setTimeout(() => {
            onRemove(carId)
        }, 200)

        // Keep the removing state for the full animation duration
        // This prevents the car from reappearing when Convex updates
        setTimeout(() => {
            setRemovingCarId(null)
            setRemovingCars(prev => {
                const newSet = new Set(prev)
                newSet.delete(carId)
                return newSet
            })
        }, ANIMATION_DURATIONS.EXIT)
    }, [])

    const isCarRemoving = useCallback((carId: string) => {
        return removingCars.has(carId)
    }, [removingCars])

    return {
        removingCarId,
        newCarIds,
        handleRemoveCar,
        isCarRemoving
    }
}
