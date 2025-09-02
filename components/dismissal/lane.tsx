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
                    <>
                        {cars.slice().reverse().map((car) => (
                            <CarCard
                                key={car.id}
                                car={car}
                                lane={lane}
                                onRemove={onRemoveCar}
                                showRemoveButton={mode === 'dispatcher'}
                            />
                        ))}
                    </>
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
