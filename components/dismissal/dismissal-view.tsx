"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Car, ChevronLeft, ChevronRight, MapPin, AlertCircle, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CAMPUS_LOCATIONS, type CampusLocation, type Id } from "@/convex/types"
import { cn } from "@/lib/utils"
import { Road } from "./road"
import { CarData, ModeType } from "./types"

interface DismissalViewProps {
    mode: ModeType
    className?: string
}

export function DismissalView({ mode, className }: DismissalViewProps) {
    const t = useTranslations('dismissal')

    const [selectedCampus, setSelectedCampus] = React.useState<string>("Poinciana Campus")
    const [isFullscreen, setIsFullscreen] = React.useState(false)
    const [carInputValue, setCarInputValue] = React.useState<string>('')
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Alert state
    const [alert, setAlert] = React.useState<{
        show: boolean
        type: 'success' | 'error'
        title: string
        message: string
    }>({
        show: false,
        type: 'success',
        title: '',
        message: ''
    })

    // Convex hooks - para obtener datos en tiempo real
    const queueData = useQuery(api.queue.getCurrentQueue,
        selectedCampus ? { campus: selectedCampus } : "skip"
    )

    // Mutations de Convex
    const addCarToQueue = useMutation(api.queue.addCar)
    const removeCarFromQueue = useMutation(api.queue.removeCar)

    // Campus selection validation
    const isCampusSelected = selectedCampus !== "all" && selectedCampus !== ""

    // Function to show alerts
    const showAlert = React.useCallback((type: 'success' | 'error', title: string, message: string) => {
        setAlert({
            show: true,
            type,
            title,
            message
        })

        // Auto-hide after 5 seconds
        setTimeout(() => {
            setAlert(prev => ({ ...prev, show: false }))
        }, 5000)
    }, [])

    // Function to hide alert manually
    const hideAlert = React.useCallback(() => {
        setAlert(prev => ({ ...prev, show: false }))
    }, [])

    // Transform Convex queue data to CarData format
    const { leftLaneCars, rightLaneCars, totalCars, isLoading, authError } = React.useMemo(() => {
        if (!queueData) {
            return { leftLaneCars: [], rightLaneCars: [], totalCars: 0, isLoading: true, authError: false }
        }

        // Handle authentication states
        if (queueData.authState === "unauthenticated") {
            return { leftLaneCars: [], rightLaneCars: [], totalCars: 0, isLoading: true, authError: false }
        }

        if (queueData.authState === "error") {
            return { leftLaneCars: [], rightLaneCars: [], totalCars: 0, isLoading: false, authError: true }
        }

        if (!queueData.leftLane || !queueData.rightLane) {
            return { leftLaneCars: [], rightLaneCars: [], totalCars: 0, isLoading: false, authError: false }
        }

        const transformQueueEntry = (entry: {
            _id: string;
            carNumber: number;
            lane: "left" | "right";
            position: number;
            assignedTime: number;
            students: Array<{ studentId: string; name: string; grade: string; avatarUrl?: string }>;
            campusLocation: string;
            carColor: string;
        }): CarData => ({
            id: entry._id,
            carNumber: entry.carNumber,
            lane: entry.lane,
            position: entry.position,
            assignedTime: new Date(entry.assignedTime),
            students: entry.students.map((s) => ({
                id: s.studentId,
                name: s.name,
                grade: s.grade,
                imageUrl: s.avatarUrl
            })),
            campus: entry.campusLocation,
            imageColor: entry.carColor
        })

        const leftCars = queueData.leftLane.map(transformQueueEntry)
        const rightCars = queueData.rightLane.map(transformQueueEntry)

        return {
            leftLaneCars: leftCars,
            rightLaneCars: rightCars,
            totalCars: leftCars.length + rightCars.length,
            isLoading: false,
            authError: false
        }
    }, [queueData])

    // Add car function using Convex mutation
    const handleAddCarToLane = React.useCallback(async (lane: 'left' | 'right') => {
        if (!carInputValue.trim() || isSubmitting) return

        const carNumber = parseInt(carInputValue.trim())
        if (isNaN(carNumber) || carNumber <= 0) {
            showAlert('error', 'Invalid Car Number', 'Please enter a valid car number')
            return
        }

        if (!isCampusSelected) {
            showAlert('error', 'Campus Required', 'Please select a campus')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await addCarToQueue({
                carNumber,
                campus: selectedCampus,
                lane
            })

            if (result.success) {
                setCarInputValue('') // Clear input after successful add
                showAlert('success', 'Car Added!', `Car ${carNumber} has been added to the ${lane} lane`)
            } else {
                // Handle different error types
                switch (result.error) {
                    case 'NO_STUDENTS_FOUND':
                        showAlert('error', 'Car Not Found', `No students found with car number ${carNumber}`)
                        break
                    case 'CAR_ALREADY_IN_QUEUE':
                        showAlert('error', 'Car Already in Queue', `Car ${carNumber} is already in the dismissal queue`)
                        break
                    case 'INVALID_CAR_NUMBER':
                        showAlert('error', 'Invalid Car Number', 'Please enter a valid car number')
                        break
                    case 'INVALID_CAMPUS':
                        showAlert('error', 'Campus Required', 'Please select a campus')
                        break
                    default:
                        showAlert('error', 'Error', result.message || 'An unexpected error occurred')
                }
            }
        } catch (error) {
            console.error("Error adding car to queue:", error)
            showAlert('error', 'Error', 'Failed to add car to queue')
        } finally {
            setIsSubmitting(false)
        }
    }, [carInputValue, selectedCampus, isCampusSelected, addCarToQueue, isSubmitting, showAlert])

    // Remove car function using Convex mutation
    const handleRemoveCar = React.useCallback(async (carId: string) => {
        if (isSubmitting) return

        setIsSubmitting(true)
        try {
            const result = await removeCarFromQueue({ queueId: carId as Id<"dismissalQueue"> })
            if (result && result.carNumber) {
                showAlert('success', 'Car Removed!', `Car ${result.carNumber} has been removed from the queue`)
            }
        } catch (error) {
            console.error("Error removing car from queue:", error)
            showAlert('error', 'Error', 'Failed to remove car from queue')
        } finally {
            setIsSubmitting(false)
        }
    }, [removeCarFromQueue, isSubmitting, showAlert])

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
                <div className="flex-shrink-0 relative">
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
                    {/* Auth State Indicator */}
                    {isLoading && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"
                            title="Loading authentication..." />
                    )}
                    {authError && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                            title="Authentication error" />
                    )}
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
                                            disabled={!carInputValue.trim() || isSubmitting}
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
                                            disabled={isSubmitting}
                                            className="text-center text-base sm:text-lg font-bold border-2 border-gray-300 focus:border-yankees-blue focus:ring-2 focus:ring-yankees-blue/20 h-10 sm:h-12 rounded-lg sm:rounded-xl shadow-sm bg-white disabled:opacity-50"
                                            autoFocus
                                        />

                                        {/* Right Arrow Button */}
                                        <Button
                                            onClick={() => handleAddCarToLane('right')}
                                            disabled={!carInputValue.trim() || isSubmitting}
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

            {/* Alert Component - Fixed at bottom right */}
            {alert.show && (
                <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
                    <Alert
                        variant={alert.type === 'error' ? 'destructive' : 'default'}
                        className="max-w-sm w-auto bg-white shadow-lg cursor-pointer border-2 transition-all hover:shadow-xl"
                        onClick={hideAlert}
                    >
                        {alert.type === 'error' ? (
                            <AlertCircle className="h-4 w-4" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                        <AlertDescription className="text-sm mt-1">
                            {alert.message}
                            <div className="text-xs text-muted-foreground mt-1">Tap to dismiss</div>
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    )
}