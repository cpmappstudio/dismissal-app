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
}

export const Lane = React.memo<LaneProps>(({ cars, lane, mode, onRemoveCar, emptyMessage }) => {
    const t = useTranslations('dismissal')

    // Use custom hook for animation logic
    const { removingCarId, newCarIds, handleRemoveCar } = useCarAnimations(cars)

    // Handle remove car with animation
    const onRemove = React.useCallback((carId: string) => {
        handleRemoveCar(carId, onRemoveCar)
    }, [handleRemoveCar, onRemoveCar])

    // Get lane colors from constants
    const colors = LANE_COLORS[lane]

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
                                        onRemove={onRemove}
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
})

Lane.displayName = 'Lane'
