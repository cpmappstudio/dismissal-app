"use client"

import * as React from "react"
import { CarQueue, type CarData } from "./car-queue"
import { CarControlPanel } from "./car-control-panel"
import { cn } from "@/lib/utils"

interface DismissalViewProps {
    mode: 'allocator' | 'dispatcher'
    className?: string
}

export function DismissalView({ mode, className }: DismissalViewProps) {
    const [cars, setCars] = React.useState<CarData[]>([])
    const [nextId, setNextId] = React.useState(1)

    // Stats
    const leftLaneCars = cars.filter(car => car.lane === 'left').length
    const rightLaneCars = cars.filter(car => car.lane === 'right').length
    const totalCars = cars.length

    // Add car function for allocator
    const handleAddCar = React.useCallback((carNumber: number, lane: 'left' | 'right') => {
        const newCar: CarData = {
            id: `car-${nextId}`,
            carNumber,
            lane,
            position: cars.filter(c => c.lane === lane).length + 1,
            assignedTime: new Date(),
            studentName: `Student ${carNumber}`, // Mock data
        }

        setCars(prev => [...prev, newCar])
        setNextId(prev => prev + 1)
    }, [cars, nextId])

    // Remove car function for dispatcher
    const handleRemoveCar = React.useCallback((carId: string) => {
        setCars(prev => {
            const updatedCars = prev.filter(car => car.id !== carId)

            // Reorder positions for each lane
            const leftCars = updatedCars.filter(car => car.lane === 'left')
                .map((car, index) => ({ ...car, position: index + 1 }))

            const rightCars = updatedCars.filter(car => car.lane === 'right')
                .map((car, index) => ({ ...car, position: index + 1 }))

            return [...leftCars, ...rightCars]
        })
    }, [])

    const handleCarClick = React.useCallback((car: CarData) => {
        if (mode === 'dispatcher') {
            handleRemoveCar(car.id)
        }
    }, [mode, handleRemoveCar])

    return (
        <div className={cn("w-full h-full", className)}>


            <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
                {/* Control Panel */}
                <div className="lg:col-span-1">
                    <CarControlPanel
                        mode={mode}
                        onAddCar={handleAddCar}
                        onRemoveCar={handleRemoveCar}
                        totalCars={totalCars}
                        leftLaneCars={leftLaneCars}
                        rightLaneCars={rightLaneCars}
                        className="sticky top-4"
                    />
                </div>

                {/* Road Lanes */}
                <div className="lg:col-span-3">
                    <div className="relative h-full">
                        {/* Road Background */}
                        <div className="absolute inset-0 bg-gray-800 rounded-lg p-4">
                            <div className="h-full bg-gray-700 rounded-lg relative overflow-hidden">
                                {/* Road Markings */}
                                <div className="absolute inset-y-0 left-1/2 w-1 bg-yellow-400 transform -translate-x-1/2">
                                    <div className="h-full bg-gradient-to-b from-transparent via-yellow-300 to-transparent opacity-60"></div>
                                </div>

                                {/* Dashed Center Line */}
                                <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2">
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-1 h-4 bg-yellow-300 mb-2"
                                            style={{
                                                marginTop: i === 0 ? '2rem' : '0',
                                                opacity: 0.8
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Lanes Content */}
                        <div className="relative z-10 h-full p-6">
                            <div className="grid grid-cols-2 gap-8 h-full">
                                {/* Left Lane */}
                                <CarQueue
                                    cars={cars}
                                    lane="left"
                                    direction={mode === 'allocator' ? 'down' : 'up'}
                                    onCarClick={handleCarClick}
                                    className="bg-white/90 backdrop-blur-sm"
                                />

                                {/* Right Lane */}
                                <CarQueue
                                    cars={cars}
                                    lane="right"
                                    direction={mode === 'allocator' ? 'down' : 'up'}
                                    onCarClick={handleCarClick}
                                    className="bg-white/90 backdrop-blur-sm"
                                />
                            </div>
                        </div>

                        {/* Entry/Exit Labels */}
                        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20">
                            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full border-2 border-yankees-blue">
                                <p className="text-sm font-semibold text-yankees-blue">
                                    {mode === 'allocator' ? 'SCHOOL ENTRANCE' : 'PICKUP EXIT'}
                                </p>
                            </div>
                        </div>

                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20">
                            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full border-2 border-green-600">
                                <p className="text-sm font-semibold text-green-600">
                                    {mode === 'allocator' ? 'PICKUP ZONE' : 'SCHOOL EXIT'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
