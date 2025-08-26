"use client"

import * as React from "react"
import { Car } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CarData {
    id: string
    carNumber: number
    studentName?: string
    assignedTime?: Date
    lane: 'left' | 'right'
    position: number
}

interface CarQueueProps {
    cars: CarData[]
    lane: 'left' | 'right'
    direction: 'up' | 'down'
    onCarClick?: (car: CarData) => void
    className?: string
}

export function CarQueue({ cars, lane, direction, onCarClick, className }: CarQueueProps) {
    const laneCars = cars.filter(car => car.lane === lane).sort((a, b) =>
        direction === 'down' ? a.position - b.position : b.position - a.position
    )

    return (
        <div className={cn(
            "relative flex flex-col gap-2 p-4 min-h-[400px] bg-gray-100/50 rounded-lg border-2 border-dashed",
            lane === 'left' ? "border-blue-300" : "border-green-300",
            className
        )}>
            {/* Lane Header */}
            <div className="text-center">
                <h3 className={cn(
                    "font-semibold text-sm uppercase tracking-wide",
                    lane === 'left' ? "text-blue-600" : "text-green-600"
                )}>
                    {lane === 'left' ? 'Left Lane' : 'Right Lane'}
                </h3>
                <p className="text-xs text-muted-foreground">
                    {laneCars.length} {laneCars.length === 1 ? 'car' : 'cars'}
                </p>
            </div>

            {/* Direction Indicator */}
            <div className="flex justify-center mb-2">
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                    direction === 'down' ? "bg-blue-500" : "bg-orange-500"
                )}>
                    {direction === 'down' ? '↓' : '↑'}
                </div>
            </div>

            {/* Cars */}
            <div className={cn(
                "flex flex-col gap-3 flex-1",
                direction === 'up' && "flex-col-reverse"
            )}>
                {laneCars.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-muted-foreground text-sm">No cars in queue</p>
                    </div>
                ) : (
                    laneCars.map((car, index) => (
                        <CarItem
                            key={car.id}
                            car={car}
                            position={index + 1}
                            onClick={() => onCarClick?.(car)}
                            lane={lane}
                        />
                    ))
                )}
            </div>

            {/* Queue Entry/Exit Indicator */}
            <div className="text-center pt-2 border-t border-gray-300">
                <p className="text-xs text-muted-foreground">
                    {direction === 'down' ? 'Cars enter from top' : 'Cars exit from top'}
                </p>
            </div>
        </div>
    )
}

interface CarItemProps {
    car: CarData
    position: number
    onClick?: () => void
    lane: 'left' | 'right'
}

function CarItem({ car, position, onClick, lane }: CarItemProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "relative p-3 rounded-lg border-2 bg-white shadow-sm cursor-pointer transition-all hover:shadow-md",
                lane === 'left' ? "border-blue-200 hover:border-blue-400" : "border-green-200 hover:border-green-400",
                "hover:scale-105"
            )}
        >
            {/* Position Number */}
            <div className={cn(
                "absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                lane === 'left' ? "bg-blue-500" : "bg-green-500"
            )}>
                {position}
            </div>

            <div className="flex items-center gap-3">
                {/* Car Icon */}
                <div className={cn(
                    "p-2 rounded-full",
                    lane === 'left' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                )}>
                    <Car className="w-5 h-5" />
                </div>

                {/* Car Info */}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">#{car.carNumber}</span>
                        {car.assignedTime && (
                            <span className="text-xs text-muted-foreground">
                                {car.assignedTime.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                    {car.studentName && (
                        <p className="text-sm text-muted-foreground truncate">{car.studentName}</p>
                    )}
                </div>
            </div>
        </div>
    )
}
