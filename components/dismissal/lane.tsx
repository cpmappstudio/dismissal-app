"use client"

import * as React from "react"
import { Car } from "lucide-react"
import { useTranslations } from "next-intl"
import { CarCard } from "./car-card"
import { CarData, LaneType, ModeType } from "./types"
import { LANE_COLORS } from "./constants"
import { useCarAnimations } from "./hooks"

interface LaneProps {
    cars: CarData[]
    lane: LaneType
    mode: ModeType
    onRemoveCar: (carId: string) => void
    emptyMessage?: string
    birthdayCarIds?: Set<string>
}

export const Lane = React.memo<LaneProps>(({ cars, lane, mode, onRemoveCar, emptyMessage, birthdayCarIds }) => {
    const t = useTranslations('dismissal')
    const isViewer = mode === 'viewer'

    // Use custom hook for animation logic
    const { newCarIds, handleRemoveCar, isCarRemoving } = useCarAnimations(cars)

    // Local state to keep track of cars being removed
    const [removingCars, setRemovingCars] = React.useState<Map<string, CarData>>(new Map())

    // Update removing cars when cars change
    React.useEffect(() => {
        const currentCarIds = new Set(cars.map(car => car.id))
        setRemovingCars(prev => {
            const newMap = new Map(prev)
            // Remove cars that are no longer being animated
            for (const [carId] of newMap) {
                if (currentCarIds.has(carId) || !isCarRemoving(carId)) {
                    newMap.delete(carId)
                }
            }
            return newMap
        })
    }, [cars, isCarRemoving])

    // Handle remove car with local state tracking
    const onRemove = React.useCallback((carId: string) => {
        const carToRemove = cars.find(car => car.id === carId)
        if (carToRemove) {
            setRemovingCars(prev => new Map(prev).set(carId, carToRemove))
        }
        handleRemoveCar(carId, onRemoveCar)
    }, [handleRemoveCar, onRemoveCar, cars])

    // Get lane colors from constants
    const colors = LANE_COLORS[lane]

    // Create extended cars list that includes cars being removed for smooth animation
    const extendedCars = React.useMemo(() => {
        const carsMap = new Map(cars.map(car => [car.id, car]))
        const result: CarData[] = []

        // Add all current cars
        cars.forEach(car => result.push(car))

        // Add cars that are being removed but no longer in the current data
        for (const [carId, car] of removingCars) {
            if (!carsMap.has(carId) && isCarRemoving(carId)) {
                result.push(car)
            }
        }

        return result
    }, [cars, removingCars, isCarRemoving])

    return (
        <div className={`p-2 md:p-4 flex relative ${isViewer
            ? `max-md:w-1/2 max-md:pb-20 max-md:flex-col max-md:min-h-full md:h-1/2 md:pl-20 md:flex-row md:min-w-full ${lane === 'left' ? 'max-md:pr-1 md:pb-1' : 'max-md:pl-1 md:pt-1'}`
            : 'w-1/2 pb-20 md:pb-20 flex-col min-h-full'
            }`} style={{ backgroundColor: '#9CA3AF' }}>
            <div className={`flex-1 min-h-0 flex ${isViewer
                ? 'max-md:flex-col max-md:justify-end max-md:gap-4 md:flex-row md:justify-start md:items-center md:gap-4'
                : 'flex-col justify-end gap-4'
                }`}>
                {cars.length > 0 ? (
                    <div className={`flex transition-all duration-500 ease-in-out ${isViewer
                        ? 'max-md:flex-col max-md:gap-4 md:flex-row-reverse'
                        : 'flex-col gap-4'
                        }`}>
                        {extendedCars.slice().reverse().map((car) => {
                            const isNew = newCarIds.has(car.id)
                            const isRemoving = isCarRemoving(car.id)

                            return (
                                <div
                                    key={car.id}
                                    className={`transition-all duration-500 ease-in-out ${
                                        isNew 
                                            ? (isViewer ? 'max-md:animate-fade-in-down md:animate-fade-in-left' : 'animate-fade-in-down')
                                            : isRemoving 
                                                ? (isViewer ? 'max-md:animate-fade-out-down md:animate-fade-out-right' : 'animate-fade-out-down')
                                                : ''
                                        }`}
                                    style={{
                                        // Fallback styles in case animations don't load
                                        transform: isRemoving
                                            ? (isViewer 
                                                ? (typeof window !== 'undefined' && window.innerWidth < 768 
                                                    ? 'translateY(20px) scale(0.95)' 
                                                    : 'translateX(20px) scale(0.95)')
                                                : 'translateY(20px) scale(0.95)')
                                            : (isViewer 
                                                ? (typeof window !== 'undefined' && window.innerWidth < 768 
                                                    ? 'translateY(0) scale(1)' 
                                                    : 'translateX(0) scale(1)')
                                                : 'translateY(0) scale(1)'),
                                        opacity: isRemoving ? 0 : 1,
                                        transition: 'all 0.6s ease-in-out'
                                    }}
                                >
                                    <CarCard
                                        car={car}
                                        lane={lane}
                                        onRemove={onRemove}
                                        showRemoveButton={mode === 'dispatcher'}
                                        isViewerMode={mode === 'viewer'}
                                        hasBirthdayToday={birthdayCarIds?.has(car.id) || false}
                                    />
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className={`flex items-center justify-center text-muted-foreground ${isViewer ? 'max-md:h-48 md:w-48 md:h-full' : 'h-48'
                        }`}>
                        <div className="text-center">
                            <div className={`${colors.iconColor} mb-2`}>
                                <Car className="h-8 w-8 mx-auto opacity-50" />
                            </div>
                            <span className={`text-sm ${colors.textColor} opacity-70`}>
                                {emptyMessage || t('table.empty')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
})

Lane.displayName = 'Lane'
