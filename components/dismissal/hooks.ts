import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { CarData, RemoveCarHandler } from './types'
import { ANIMATION_DURATIONS } from './constants'

interface UseCarAnimationsReturn {
    newCarIds: Set<string>
    handleRemoveCar: (carId: string, onRemove: RemoveCarHandler) => boolean
    isCarRemoving: (carId: string) => boolean
}

export function useCarAnimations(cars: CarData[]): UseCarAnimationsReturn {
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

    const handleRemoveCar = useCallback((carId: string, onRemove: RemoveCarHandler) => {
        // Acquire the view's mutation lock before starting any visual removal.
        const removal = onRemove(carId)
        if (!removal) return false

        setRemovingCars(prev => new Set(prev).add(carId))

        // Keep slow requests hidden until completion; restore immediately on failure.
        const animation = new Promise<void>(resolve => setTimeout(resolve, ANIMATION_DURATIONS.EXIT))
        void Promise.all([removal, animation])
            .catch(() => { /* The view reports the mutation error. */ })
            .finally(() => {
                setRemovingCars(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(carId)
                    return newSet
                })
            })
        return true
    }, [])

    const isCarRemoving = useCallback((carId: string) => {
        return removingCars.has(carId)
    }, [removingCars])

    return {
        newCarIds,
        handleRemoveCar,
        isCarRemoving
    }
}
