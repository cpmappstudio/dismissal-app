"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Trash2, Plus, Car, Users, BarChart3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CampusSelector, type CampusLocationType } from "@/components/ui/campus-selector"
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
            assignedTime: new Date(Date.now() - 5 * 60000), // 5 minutes ago
            studentName: 'María González',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-2',
            carNumber: 205,
            lane: 'left',
            position: 2,
            assignedTime: new Date(Date.now() - 3 * 60000), // 3 minutes ago
            studentName: 'Carlos Rodríguez',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-3',
            carNumber: 89,
            lane: 'right',
            position: 1,
            assignedTime: new Date(Date.now() - 7 * 60000), // 7 minutes ago
            studentName: 'Ana Martínez',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-4',
            carNumber: 156,
            lane: 'right',
            position: 2,
            assignedTime: new Date(Date.now() - 2 * 60000), // 2 minutes ago
            studentName: 'Pedro Sánchez',
            campus: 'Poinciana Campus'
        },
        {
            id: 'car-5',
            carNumber: 78,
            lane: 'right',
            position: 3,
            assignedTime: new Date(Date.now() - 1 * 60000), // 1 minute ago
            studentName: 'Laura Torres',
            campus: 'Poinciana Campus'
        }
    ])
    const [nextId, setNextId] = React.useState(6)

    // Input states for allocator mode - dynamic based on campus
    const getInitialInputs = React.useCallback((campus: string) => {
        if (campus === 'Poinciana Campus') {
            return {
                left: ['102', '234', ''],
                right: ['67', '189', '321', '']
            }
        }
        // Empty inputs for all other campuses
        return {
            left: [''],
            right: ['']
        }
    }, [])

    const [leftLaneInputs, setLeftLaneInputs] = React.useState<string[]>(getInitialInputs(selectedCampus).left)
    const [rightLaneInputs, setRightLaneInputs] = React.useState<string[]>(getInitialInputs(selectedCampus).right)

    // Reset inputs when campus changes
    React.useEffect(() => {
        const initialInputs = getInitialInputs(selectedCampus)
        setLeftLaneInputs(initialInputs.left)
        setRightLaneInputs(initialInputs.right)
    }, [selectedCampus, getInitialInputs])

    // Campus selection validation
    const isCampusSelected = selectedCampus !== "all"

    // Stats - filtered by selected campus
    const leftLaneCars = cars.filter(car => car.lane === 'left' && car.campus === selectedCampus)
    const rightLaneCars = cars.filter(car => car.lane === 'right' && car.campus === selectedCampus)
    const totalCars = leftLaneCars.length + rightLaneCars.length

    // Add car function for allocator
    const handleAddCar = React.useCallback((carNumber: number, lane: 'left' | 'right') => {
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
    }, [cars, nextId, selectedCampus])

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

    // Handle input submission for allocator
    const handleSubmitCar = React.useCallback((value: string, lane: 'left' | 'right', inputIndex: number) => {
        if (!value.trim()) return

        const carNumber = parseInt(value.trim())
        if (isNaN(carNumber)) return

        handleAddCar(carNumber, lane)

        // Keep the current input with its value and add new empty input below
        const updateInputs = lane === 'left' ? setLeftLaneInputs : setRightLaneInputs
        updateInputs(prev => {
            const newInputs = [...prev]
            // Add new empty input at the end
            newInputs.push('')
            return newInputs
        })
    }, [handleAddCar])    // Handle input change
    const handleInputChange = React.useCallback((value: string, lane: 'left' | 'right', inputIndex: number) => {
        const updateInputs = lane === 'left' ? setLeftLaneInputs : setRightLaneInputs
        updateInputs(prev => {
            const newInputs = [...prev]
            newInputs[inputIndex] = value
            return newInputs
        })
    }, [])

    // Format time
    const formatTime = React.useCallback((date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }, [])

    return (
        <div className={cn("w-full space-y-6", className)}>
            {/* Campus Selection and Lane Balance */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                <div className="flex-shrink-0">
                    <CampusSelector
                        value={selectedCampus}
                        onChange={setSelectedCampus}
                        placeholder={t('campus.select')}
                        className="w-full md:w-64"
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

            {/* Main Content */}
            {!isCampusSelected ? (
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
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Lane */}
                    <Card className="border-2 border-blue-500">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-blue-600">{t('stats.leftLane')}</span>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                                    {leftLaneCars.length}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Allocator Inputs */}
                            {mode === 'allocator' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        {leftLaneInputs.map((value, index) => (
                                            <div key={index} className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder={t('allocator.addCarPlaceholder')}
                                                    value={value}
                                                    onChange={(e) => handleInputChange(e.target.value, 'left', index)}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleSubmitCar(value, 'left', index)
                                                        }
                                                    }}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    onClick={() => handleSubmitCar(value, 'left', index)}
                                                    disabled={!value.trim()}
                                                    size="sm"
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Dispatcher List */}
                            {mode === 'dispatcher' && leftLaneCars.length > 0 && (
                                <div className="space-y-2">
                                    {leftLaneCars.map((car) => (
                                        <div key={car.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border">
                                            <div className="flex flex-col">
                                                <span className="font-medium">Car #{car.carNumber}</span>
                                                <span className="text-sm text-muted-foreground">{car.studentName}</span>
                                                <span className="text-xs text-muted-foreground">{formatTime(car.assignedTime)}</span>
                                            </div>
                                            <Button
                                                onClick={() => handleRemoveCar(car.id)}
                                                size="sm"
                                                variant="destructive"
                                                className="h-8 w-8 p-0"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {mode === 'dispatcher' && leftLaneCars.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    {t('table.empty')}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Right Lane */}
                    <Card className="border-2 border-green-500">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="text-green-600">{t('stats.rightLane')}</span>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                                    {rightLaneCars.length}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Allocator Inputs */}
                            {mode === 'allocator' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        {rightLaneInputs.map((value, index) => (
                                            <div key={index} className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder={t('allocator.addCarPlaceholder')}
                                                    value={value}
                                                    onChange={(e) => handleInputChange(e.target.value, 'right', index)}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleSubmitCar(value, 'right', index)
                                                        }
                                                    }}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    onClick={() => handleSubmitCar(value, 'right', index)}
                                                    disabled={!value.trim()}
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Dispatcher List */}
                            {mode === 'dispatcher' && rightLaneCars.length > 0 && (
                                <div className="space-y-2">
                                    {rightLaneCars.map((car) => (
                                        <div key={car.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border">
                                            <div className="flex flex-col">
                                                <span className="font-medium">Car #{car.carNumber}</span>
                                                <span className="text-sm text-muted-foreground">{car.studentName}</span>
                                                <span className="text-xs text-muted-foreground">{formatTime(car.assignedTime)}</span>
                                            </div>
                                            <Button
                                                onClick={() => handleRemoveCar(car.id)}
                                                size="sm"
                                                variant="destructive"
                                                className="h-8 w-8 p-0"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {mode === 'dispatcher' && rightLaneCars.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    {t('table.empty')}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}