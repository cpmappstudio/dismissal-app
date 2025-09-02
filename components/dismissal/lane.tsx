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
    const isViewer = mode === 'viewer'

    // Use custom hook for animation logic
    const { removingCarId, newCarIds, handleRemoveCar } = useCarAnimations(cars)

    // Handle remove car with animation
    const onRemove = React.useCallback((carId: string) => {
        handleRemoveCar(carId, onRemoveCar)
    }, [handleRemoveCar, onRemoveCar])

    // Get lane colors from constants
    const colors = LANE_COLORS[lane]

    return (
        <div className={`p-2 md:p-4 flex relative ${isViewer
            ? `h-1/2 pl-20 md:pl-20 flex-row min-w-full ${lane === 'left' ? 'pb-1' : 'pt-1'}`
            : 'w-1/2 pb-20 md:pb-20 flex-col min-h-full'
            }`} style={{ backgroundColor: '#9CA3AF' }}>
            <div className={`flex-1 flex ${isViewer
                ? 'flex-row justify-start gap-8'
                : 'flex-col justify-end gap-4'
                }`}>
                {cars.length > 0 ? (
                    <div className={`flex transition-all duration-500 ease-in-out ${isViewer
                        ? 'flex-row-reverse gap-6'
                        : 'flex-col gap-4'
                        }`}>
                        {cars.slice().reverse().map((car, index) => {
                            const isNew = newCarIds.has(car.id)
                            const isRemoving = removingCarId === car.id

                            return (
                                <div
                                    key={car.id}
                                    className={`transition-all duration-500 ease-in-out ${isNew ? (isViewer ? 'animate-fade-in-left' : 'animate-fade-in-down') :
                                        isRemoving ? (isViewer ? 'animate-fade-out-right' : 'animate-fade-out-down') : ''
                                        }`}
                                    style={{
                                        // Fallback styles in case animations don't load
                                        transform: isRemoving
                                            ? (isViewer ? 'translateX(20px) scale(0.95)' : 'translateY(20px) scale(0.95)')
                                            : (isViewer ? 'translateX(0) scale(1)' : 'translateY(0) scale(1)'),
                                        opacity: isRemoving ? 0 : 1,
                                        transition: 'all 0.5s ease-in-out'
                                    }}
                                >
                                    <CarCard
                                        car={car}
                                        lane={lane}
                                        onRemove={onRemove}
                                        showRemoveButton={mode === 'dispatcher'}
                                        isViewerMode={mode === 'viewer'}
                                    />
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className={`flex items-center justify-center text-muted-foreground ${isViewer ? 'w-48 h-full' : 'h-48'
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
