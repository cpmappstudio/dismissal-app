"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Trash2, Plus, Car, Users, BarChart3, ChevronLeft, ChevronRight, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { CAMPUS_LOCATIONS, type CampusLocation } from "@/lib/constants"
import { cn } from "@/lib/utils"

export interface CarData {
    id: string
    carNumber: number
    lane: 'left' | 'right'
    position: number
    assignedTime: Date
    studentName: string
    campus: string
}

interface DismissalViewProps {
    mode: 'allocator' | 'dispatcher'
    className?: string
}

export function DismissalView({ mode, className }: DismissalViewProps) {
    const t = useTranslations('dismissal')

    const [selectedCampus, setSelectedCampus] = React.useState<string>("Poinciana Campus")
    const [cars, setCars] = React.useState<CarData[]>([
        {
            id: 'car-1',
            carNumber: 101,
            lane: 'left',
            position: 1,
            assignedTime: new Date(Date.now() - 5 * 60000),
            studentName: 'María González',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-2',
            carNumber: 205,
            lane: 'left',
            position: 2,
            assignedTime: new Date(Date.now() - 3 * 60000),
            studentName: 'Carlos Rodríguez',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-3',
            carNumber: 89,
            lane: 'right',
            position: 1,
            assignedTime: new Date(Date.now() - 7 * 60000),
            studentName: 'Ana Martínez',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-4',
            carNumber: 156,
            lane: 'right',
            position: 2,
            assignedTime: new Date(Date.now() - 2 * 60000),
            studentName: 'Pedro Sánchez',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-5',
            carNumber: 78,
            lane: 'right',
            position: 3,
            assignedTime: new Date(Date.now() - 1 * 60000),
            studentName: 'Laura Torres',
            campus: 'Poinciana Campus'
        }
    ])
    const [nextId, setNextId] = React.useState(6)

    // Single input for allocator mode
    const [carInputValue, setCarInputValue] = React.useState<string>('')

    // Campus selection validation
    const isCampusSelected = selectedCampus !== "all"

    // Stats - filtered by selected campus
    const leftLaneCars = cars.filter(car => car.lane === 'left' && car.campus === selectedCampus)
    const rightLaneCars = cars.filter(car => car.lane === 'right' && car.campus === selectedCampus)
    const totalCars = leftLaneCars.length + rightLaneCars.length

    // Add car function for allocator with new single input approach
    const handleAddCarToLane = React.useCallback((lane: 'left' | 'right') => {
        if (!carInputValue.trim()) return

        const carNumber = parseInt(carInputValue.trim())
        if (isNaN(carNumber)) return

        const newCar: CarData = {
            id: `car-${nextId}`,
            carNumber,
            lane,
            position: cars.filter(c => c.lane === lane && c.campus === selectedCampus).length + 1,
            assignedTime: new Date(),
            studentName: `Student ${carNumber}`, // Mock data
            campus: selectedCampus
        }

        setCars(prev => [...prev, newCar])
        setNextId(prev => prev + 1)
        setCarInputValue('') // Clear input after adding
    }, [carInputValue, cars, nextId, selectedCampus])

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

    // Format time
    const formatTime = React.useCallback((date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }, [])

    return (
        <div className={cn("w-full h-full flex flex-col", className)}>
            {/* Campus Selection and Lane Balance */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6 flex-shrink-0">
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
                    <div className="flex-1 min-h-0" style={{ marginBottom: mode === 'allocator' ? '6rem' : '0' }}>
                        {/* Single Card for Both Lanes */}
                        <Card className="border-2 border-yankees-blue flex flex-col h-[calc(100vh-14rem)] max-h-[calc(100vh-14rem)] py-0 overflow-hidden">
                            <CardContent className="flex-1 overflow-y-auto min-h-0 p-0">
                                <div className="grid grid-cols-2 h-full">
                                    {/* Left Lane */}
                                    <div className="border-r border-gray-200 p-4">
                                        {leftLaneCars.length > 0 ? (
                                            <div className="gap-3 flex flex-col">
                                                {leftLaneCars.map((car) => (
                                                    <div key={car.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 flex-shrink-0 shadow-sm">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-medium text-blue-900">Car #{car.carNumber}</span>
                                                            <span className="text-sm text-blue-700">{car.studentName}</span>
                                                            <span className="text-xs text-blue-600">{formatTime(car.assignedTime)}</span>
                                                        </div>
                                                        {mode === 'dispatcher' && (
                                                            <Button
                                                                onClick={() => handleRemoveCar(car.id)}
                                                                size="sm"
                                                                variant="destructive"
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center text-muted-foreground h-48">
                                                <div className="text-center">
                                                    <div className="text-blue-400 mb-2">
                                                        <Car className="h-8 w-8 mx-auto" />
                                                    </div>
                                                    {t('table.empty')}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Lane */}
                                    <div className="p-4">
                                        {rightLaneCars.length > 0 ? (
                                            <div className="gap-3 flex flex-col">
                                                {rightLaneCars.map((car) => (
                                                    <div key={car.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 flex-shrink-0 shadow-sm">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-medium text-green-900">Car #{car.carNumber}</span>
                                                            <span className="text-sm text-green-700">{car.studentName}</span>
                                                            <span className="text-xs text-green-600">{formatTime(car.assignedTime)}</span>
                                                        </div>
                                                        {mode === 'dispatcher' && (
                                                            <Button
                                                                onClick={() => handleRemoveCar(car.id)}
                                                                size="sm"
                                                                variant="destructive"
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center text-muted-foreground h-48">
                                                <div className="text-center">
                                                    <div className="text-green-400 mb-2">
                                                        <Car className="h-8 w-8 mx-auto" />
                                                    </div>
                                                    {t('table.empty')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Floating Input for Allocator Mode */}
                    {mode === 'allocator' && (
                        <div className="absolute bottom-3 left-0 right-0 px-4">
                            <div className="max-w-sm mx-auto">
                                <div className="bg-white/95 backdrop-blur-sm border-2 border-yankees-blue rounded-xl shadow-lg p-3">
                                    <div className="flex items-center gap-2">
                                        {/* Left Arrow Button */}
                                        <Button
                                            onClick={() => handleAddCarToLane('left')}
                                            disabled={!carInputValue.trim()}
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 h-10 w-10 rounded-lg shrink-0"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
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
                                            className="text-center text-base font-medium border-2 border-gray-200 focus:border-yankees-blue focus:ring-2 focus:ring-yankees-blue/20 h-10 rounded-lg"
                                            autoFocus
                                        />

                                        {/* Right Arrow Button */}
                                        <Button
                                            onClick={() => handleAddCarToLane('right')}
                                            disabled={!carInputValue.trim()}
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white p-2 h-10 w-10 rounded-lg shrink-0"
                                        >
                                            <ChevronRight className="h-4 w-4" />
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