"use client"

import * as React from "react"
import { Car } from "lucide-react"
import { useTranslations } from "next-intl"
import { CarCard } from "./car-card"
import { CarData, LaneType, ModeType } from "./types"

interface LaneProps {
    cars: CarData[]
    lane: LaneType
    mode: ModeType
    onRemoveCar: (carId: string) => void
    emptyMessage?: string
}

export function Lane({ cars, lane, mode, onRemoveCar, emptyMessage }: LaneProps) {
    const t = useTranslations('dismissal')
    const [removingCarId, setRemovingCarId] = React.useState<string | null>(null)
    const [newCarIds, setNewCarIds] = React.useState<Set<string>>(new Set())
    const prevCarsRef = React.useRef<CarData[]>([])

    // Track new cars for entrance animation
    React.useEffect(() => {
        const prevCarIds = new Set(prevCarsRef.current.map(car => car.id))
        const currentCarIds = new Set(cars.map(car => car.id))

        // Find newly added cars
        const newIds = cars.filter(car => !prevCarIds.has(car.id)).map(car => car.id)

        if (newIds.length > 0) {
            setNewCarIds(new Set(newIds))
            // Remove the new car flag after animation completes
            setTimeout(() => {
                setNewCarIds(new Set())
            }, 500) // Duration for entrance animation
        }

        prevCarsRef.current = cars
    }, [cars])

    const handleRemoveCar = React.useCallback((carId: string) => {
        setRemovingCarId(carId)
        // Wait for animation to complete before actually removing
        setTimeout(() => {
            onRemoveCar(carId)
            setRemovingCarId(null)
        }, 300) // Duration matches the animation
    }, [onRemoveCar])

    const laneColors = {
        left: {
            iconColor: 'text-blue-400',
            textColor: 'text-blue-500'
        },
        right: {
            iconColor: 'text-green-400',
            textColor: 'text-green-500'
        }
    }

    const colors = laneColors[lane]

    return (
        <div className="w-1/2 p-2 md:p-4 pb-20 md:pb-20 flex flex-col min-h-full relative" style={{ backgroundColor: '#9CA3AF' }}>
            <div className="flex-1 flex flex-col justify-end gap-4">
                {cars.length > 0 ? (
                    <div className="flex flex-col gap-4 transition-all duration-300 ease-in-out">
                        {cars.slice().reverse().map((car, index) => {
                            const isNew = newCarIds.has(car.id)
                            const isRemoving = removingCarId === car.id

                            return (
                                <div
                                    key={car.id}
                                    className={`transition-all duration-300 ease-in-out transform ${isNew ? 'animate-fade-in-down' : ''
                                        }`}
                                    style={{
                                        transform: isRemoving ? 'translateY(100px) scale(0.8)' : 'translateY(0) scale(1)',
                                        opacity: isRemoving ? 0 : 1
                                    }}
                                >
                                    <CarCard
                                        car={car}
                                        lane={lane}
                                        onRemove={handleRemoveCar}
                                        showRemoveButton={mode === 'dispatcher'}
                                    />
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center text-muted-foreground h-48">
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
}
