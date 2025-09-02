"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Car, ChevronLeft, ChevronRight, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { CAMPUS_LOCATIONS, type CampusLocation } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Road } from "./road"
import { CarData, ModeType, LaneType } from "./types"
import { getCarColor, getConsistentTime } from "./utils"
import { MOCK_CARS, INITIAL_NEXT_ID } from "./mock-cars-data"

interface DismissalViewProps {
    mode: ModeType
    className?: string
}

export function DismissalView({ mode, className }: DismissalViewProps) {
    const t = useTranslations('dismissal')

    const [selectedCampus, setSelectedCampus] = React.useState<string>("Poinciana Campus")
    const [cars, setCars] = React.useState<CarData[]>(MOCK_CARS)
    const [nextId, setNextId] = React.useState(INITIAL_NEXT_ID)
    const [isFullscreen, setIsFullscreen] = React.useState(false)

    // Single input for allocator mode
    const [carInputValue, setCarInputValue] = React.useState<string>('')

    // Campus selection validation
    const isCampusSelected = selectedCampus !== "all"

    // Stats - filtered by selected campus - Memoized to prevent unnecessary re-renders
    const leftLaneCars = React.useMemo(() =>
        cars.filter(car => car.lane === 'left' && car.campus === selectedCampus),
        [cars, selectedCampus]
    )

    const rightLaneCars = React.useMemo(() =>
        cars.filter(car => car.lane === 'right' && car.campus === selectedCampus),
        [cars, selectedCampus]
    )

    const totalCars = leftLaneCars.length + rightLaneCars.length

    // Add car function for allocator with new single input approach
    const handleAddCarToLane = React.useCallback((lane: 'left' | 'right') => {
        if (!carInputValue.trim()) return

        const carNumber = parseInt(carInputValue.trim())
        if (isNaN(carNumber)) return

        setCars(prev => {
            // Calculate position based on current state
            const existingCarsInLane = prev.filter(c => c.lane === lane && c.campus === selectedCampus).length

            const newCar: CarData = {
                id: `car-${nextId}`,
                carNumber,
                lane,
                position: existingCarsInLane + 1,
                assignedTime: getConsistentTime(carNumber),
                students: [{ id: `student-${nextId}`, name: `Student ${carNumber}`, grade: 'Grado 5' }], // Mock data
                campus: selectedCampus,
                imageColor: getCarColor(carNumber)
            }

            return [...prev, newCar]
        })

        setNextId(prev => prev + 1)
        setCarInputValue('') // Clear input after adding
    }, [carInputValue, nextId, selectedCampus]) // Removed 'cars' dependency

    // Remove car function for dispatcher
    const handleRemoveCar = React.useCallback((carId: string) => {
        setCars(prev => {
            const updatedCars = prev.filter(car => car.id !== carId)

            // Reorder positions for each lane within the selected campus
            const leftCars = updatedCars.filter(car => car.lane === 'left' && car.campus === selectedCampus)
                .map((car, index) => ({ ...car, position: index + 1 }))

            const rightCars = updatedCars.filter(car => car.lane === 'right' && car.campus === selectedCampus)
                .map((car, index) => ({ ...car, position: index + 1 }))

            // Keep cars from other campuses unchanged
            const otherCampusCars = updatedCars.filter(car => car.campus !== selectedCampus)

            return [...leftCars, ...rightCars, ...otherCampusCars]
        })
    }, [selectedCampus])

    // Handle keyboard shortcuts for the single input
    const handleKeyPress = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            // Default to right lane on Enter
            handleAddCarToLane('right')
        }
    }, [handleAddCarToLane])

    // Toggle fullscreen for viewer mode
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    return (
        <div className={cn("w-full h-full flex flex-col", className)}>
            {/* Campus Selection and Lane Balance */}
            <div className="flex flex-col gap-4  md:flex-row md:items-center md:gap-6 flex-shrink-0">
                <div className="flex-shrink-0">
                    <FilterDropdown<CampusLocation>
                        value={selectedCampus as CampusLocation}
                        onChange={(value) => setSelectedCampus(value)}
                        options={CAMPUS_LOCATIONS}
                        icon={MapPin}
                        label={t('campus.select')}
                        placeholder={t('campus.select')}
                        className="w-full md:w-64"
                        showAllOption={false}
                    />
                </div>

                {/* Lane Balance Bar */}
                <Card className={cn("flex-1 border-2 rounded-md border-yankees-blue flex items-center p-3", !isCampusSelected && "opacity-50")}>
                    <div className="relative h-1.5 rounded-full bg-gray-200 overflow-hidden w-full">
                        {totalCars > 0 ? (
                            <>
                                <div
                                    className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${(leftLaneCars.length / totalCars) * 100}%` }}
                                />
                                <div
                                    className="absolute right-0 top-0 h-full bg-green-500 transition-all duration-300"
                                    style={{ width: `${(rightLaneCars.length / totalCars) * 100}%` }}
                                />
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-gray-300" />
                        )}
                    </div>
                </Card>
            </div>

            {/* Main Content Area - Takes remaining space */}
            <div className="flex-1 flex flex-col mt-4 min-h-0 relative">{!isCampusSelected ? (
                <div className="flex-1 flex items-center justify-center">
                    <Card className="border-2 border-dashed border-yankees-blue/50">
                        <CardContent className="flex items-center justify-center h-48">
                            <div className="text-center space-y-2">
                                <Car className="h-12 w-12 text-muted-foreground mx-auto" />
                                <CardTitle className="text-lg text-muted-foreground">{t('campus.required')}</CardTitle>
                                <CardDescription>
                                    {t('campus.placeholder')}
                                </CardDescription>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <>
                    <Road
                        leftLaneCars={leftLaneCars}
                        rightLaneCars={rightLaneCars}
                        mode={mode}
                        onRemoveCar={handleRemoveCar}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={toggleFullscreen}
                    />

                    {/* Allocator Control with Finish Line - Responsive */}
                    {mode === 'allocator' && (
                        <div className="absolute bottom-3 left-0 right-0 z-20 px-2">
                            <div className="flex justify-center">
                                <div className="bg-white/90 w-full max-w-xs sm:max-w-sm backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border-white/30 relative overflow-hidden">
                                    <div className="flex items-center gap-2 sm:gap-3 relative z-10 justify-center">
                                        {/* Left Arrow Button */}
                                        <Button
                                            onClick={() => handleAddCarToLane('left')}
                                            disabled={!carInputValue.trim()}
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:p-3 h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl shrink-0 shadow-md transition-colors duration-200 disabled:opacity-50"
                                        >
                                            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </Button>

                                        {/* Car Input */}
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder={t('allocator.addCarPlaceholder')}
                                            value={carInputValue}
                                            onChange={(e) => {
                                                // Solo permitir números
                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                setCarInputValue(value)
                                            }}
                                            onKeyDown={handleKeyPress}
                                            className="text-center text-base sm:text-lg font-bold border-2 border-gray-300 focus:border-yankees-blue focus:ring-2 focus:ring-yankees-blue/20 h-10 sm:h-12 rounded-lg sm:rounded-xl shadow-sm bg-white"
                                            autoFocus
                                        />

                                        {/* Right Arrow Button */}
                                        <Button
                                            onClick={() => handleAddCarToLane('right')}
                                            disabled={!carInputValue.trim()}
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white p-2 sm:p-3 h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl shrink-0 shadow-md transition-colors duration-200 disabled:opacity-50"
                                        >
                                            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            </div>
        </div>
    )
}