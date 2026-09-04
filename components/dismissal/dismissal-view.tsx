"use client"

import * as React from "react"
import { useUser } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Car, ChevronLeft, ChevronRight, MapPin, AlertCircle, CheckCircle2 } from "lucide-react"
import { useCampusSession } from "@/hooks/use-campus-session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { type Id } from "@/convex/types"
import { cn } from "@/lib/utils"
import { canAllocate, canDispatch, extractRoleFromMetadata } from "@/lib/role-utils"
import { useBirthdayCars } from "@/hooks/use-birthday-cars"
import { Road } from "./road"
import { CarData, ModeType, RemoveCarHandler } from "./types"
import { normalizeVehicleIdentifier } from "@/lib/vehicle"
import { EarlyPickups } from "./early-pickups"

interface DismissalViewProps {
    mode: ModeType
    className?: string
}

export function DismissalView({ mode, className }: DismissalViewProps) {
    const t = useTranslations('dismissal')
    const bt = useTranslations('transport')
    const { user } = useUser()
    const role = user ? extractRoleFromMetadata(user.publicMetadata) : null
    const allowAllocate = mode === 'operator' && canAllocate(role)
    const allowDispatch = mode === 'operator' && canDispatch(role)

    // Usar el hook de sesión de campus
    const { selectedCampus, updateSelectedCampus, isLoaded: campusLoaded } = useCampusSession()
    const [isFullscreen, setIsFullscreen] = React.useState(false)
    const [carInputValue, setCarInputValue] = React.useState<string>('')
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [showClearDialog, setShowClearDialog] = React.useState(false)

    // Ref para mantener el focus del input al añadir vehículos
    const carInputRef = React.useRef<HTMLInputElement>(null)
    const [shouldMaintainFocus, setShouldMaintainFocus] = React.useState(false)

    // Ref para el timeout de la alerta
    const alertTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    // Ref para el requestAnimationFrame del focus
    const focusFrameRef = React.useRef<number | null>(null)
    // Ref para el valor actual del input (para evitar dependencias innecesarias)
    const carInputValueRef = React.useRef<string>('')
    // ponytail: one operation per view; use per-vehicle locks only if parallel entry is needed.
    const isSubmittingRef = React.useRef<boolean>(false)

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
    const carCountsByCampus = useQuery(api.queue.getCarCountsByCampus)
    const campusOptions = useQuery(api.campus.getOptions)

    // Mutations de Convex
    const addCarToQueue = useMutation(api.queue.addCar)
    const removeCarFromQueue = useMutation(api.queue.removeCar)
    const clearAllCars = useMutation(api.queue.clearAllCars)

    // Campus selection validation
    const isCampusSelected = selectedCampus !== "all" && selectedCampus !== ""

    // Helper para actualizar el valor del input (sincroniza estado y ref)
    const updateCarInputValue = React.useCallback((value: string) => {
        setCarInputValue(value)
        carInputValueRef.current = value
    }, [])

    // Helper para actualizar el estado de submitting (sincroniza estado y ref)
    const updateIsSubmitting = React.useCallback((value: boolean) => {
        setIsSubmitting(value)
        isSubmittingRef.current = value
    }, [])

    // Function to show alerts
    const showAlert = React.useCallback((type: 'success' | 'error', title: string, message: string) => {
        // Limpiar timeout anterior si existe
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current)
        }

        setAlert({
            show: true,
            type,
            title,
            message
        })

        // Auto-hide after 5 seconds
        alertTimeoutRef.current = setTimeout(() => {
            setAlert(prev => ({ ...prev, show: false }))
            alertTimeoutRef.current = null
        }, 5000)
    }, [])

    // Function to hide alert manually
    const hideAlert = React.useCallback(() => {
        // Limpiar timeout si existe al ocultar manualmente
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current)
            alertTimeoutRef.current = null
        }
        setAlert(prev => ({ ...prev, show: false }))
    }, [])

    // Transform Convex queue data to CarData format
    const { leftLaneCars, rightLaneCars, isLoading, authError } = React.useMemo(() => { // add totalCars if needed
        if (!queueData) {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: true, authError: false } // add totalCars: 0, if needed
        }

        // Handle authentication states
        if (queueData.authState === "unauthenticated") {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: true, authError: false } // add totalCars: 0, if needed
        }

        if (queueData.authState === "error") {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: false, authError: true } // add totalCars: 0, if needed
        }

        if (!queueData.leftLane || !queueData.rightLane) {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: false, authError: false } // add totalCars: 0, if needed
        }

        const transformQueueEntry = (entry: {
            _id: string;
            vehicleType?: "car" | "bus";
            carNumber: number | string;
            lane: "left" | "right";
            position: number;
            assignedTime: number;
            students: Array<{ studentId: string; name: string; grade: string; avatarUrl?: string; avatarStorageId?: Id<"_storage">;  birthday?: string }>;
            campusLocation: string;
            carColor: string;
        }): CarData => {
            return {
                id: entry._id,
                vehicleType: entry.vehicleType,
                timezone: campusOptions?.find(c => c.value === entry.campusLocation)?.timezone,
                carNumber: entry.carNumber,
                lane: entry.lane,
                position: entry.position,
                assignedTime: new Date(entry.assignedTime),
                students: entry.students.map((s) => ({
                    id: s.studentId,
                    name: s.name,
                    grade: s.grade,
                    imageUrl: s.avatarUrl,
                    avatarStorageId: s.avatarStorageId,
                    birthday: s.birthday,
                })),
                campus: entry.campusLocation,
                imageColor: entry.carColor
            }
        }

        const leftCars = queueData.leftLane.map(transformQueueEntry)
        const rightCars = queueData.rightLane.map(transformQueueEntry)

        return {
            leftLaneCars: leftCars,
            rightLaneCars: rightCars,
            // totalCars: leftCars.length + rightCars.length,
            isLoading: false,
            authError: false
        }
    }, [queueData, campusOptions])

    // Hook para verificar carros con estudiantes de cumpleaños
    const allCars = [...leftLaneCars, ...rightLaneCars]
    const { birthdayCarIds } = useBirthdayCars(allCars)

    // Add car function using Convex mutation
    const handleAddCarToLane = React.useCallback(async (lane: 'left' | 'right') => {
        const currentValue = carInputValueRef.current
        if (!allowAllocate || !currentValue.trim() || isSubmittingRef.current) return

        let carNumber: number | string
        try { carNumber = normalizeVehicleIdentifier(currentValue) }
        catch {
            showAlert('error', 'Error', bt('invalidIdentifier'))
            return
        }

        if (!isCampusSelected) {
            showAlert('error', 'Campus Required', 'Please select a campus')
            return
        }

        updateIsSubmitting(true)
        try {
            const result = await addCarToQueue({
                carNumber,
                campus: selectedCampus,
                lane
            })

            if (result.success) {
                updateCarInputValue('') // Clear input after successful add
                showAlert('success', 'Car Added!', `Car ${carNumber} has been added to the ${lane} lane`)

                // Mantener el focus en el input después de agregar el carro (para móviles)
                if (shouldMaintainFocus && carInputRef.current) {
                    // Limpiar frame anterior si existe
                    if (focusFrameRef.current) {
                        cancelAnimationFrame(focusFrameRef.current)
                    }

                    // Usar requestAnimationFrame para mejor rendimiento
                    focusFrameRef.current = requestAnimationFrame(() => {
                        if (carInputRef.current) {
                            carInputRef.current.focus()
                        }
                        focusFrameRef.current = null
                    })
                }
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
        } catch {
            showAlert('error', 'Error', 'Failed to add car to queue')
        } finally {
            updateIsSubmitting(false)
        }
    }, [allowAllocate, selectedCampus, isCampusSelected, addCarToQueue, showAlert, shouldMaintainFocus, updateCarInputValue, updateIsSubmitting, bt])

    // Remove car function using Convex mutation
    const handleRemoveCar = React.useCallback<RemoveCarHandler>((carId) => {
        if (!allowDispatch || isSubmittingRef.current) return

        updateIsSubmitting(true)
        return (async () => {
            try {
                const result = await removeCarFromQueue({ queueId: carId as Id<"dismissalQueue"> })
                if (result && result.carNumber) {
                    showAlert('success', 'Car Removed!', `Car ${result.carNumber} has been removed from the queue`)
                }
            } catch (error) {
                showAlert('error', 'Error', error instanceof Error ? error.message : 'Failed to remove car from queue')
                throw error // Let the animation roll back as well.
            } finally {
                updateIsSubmitting(false)
            }
        })()
    }, [allowDispatch, removeCarFromQueue, showAlert, updateIsSubmitting])

    // Clear all cars function
    const handleClearAllCars = React.useCallback(async () => {
        if (!allowDispatch || isSubmittingRef.current || !isCampusSelected) return

        updateIsSubmitting(true)
        try {
            const result = await clearAllCars({ campus: selectedCampus })
            if (result.success) {
                showAlert('success', t('dispatcher.allCarsCleared'), `${result.clearedCount} car(s) cleared from ${selectedCampus}`)
                setShowClearDialog(false)
            }
        } catch {
            showAlert('error', 'Error', 'Failed to clear all cars from queue')
        } finally {
            updateIsSubmitting(false)
        }
    }, [allowDispatch, clearAllCars, selectedCampus, isCampusSelected, showAlert, updateIsSubmitting, t])

    // Handle keyboard shortcuts for the single input
    const handleKeyPress = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            // Default to right lane on Enter
            handleAddCarToLane('right')
        }
    }, [handleAddCarToLane])

    // Mantener el focus mientras se añaden vehículos
    const handleInputFocus = React.useCallback(() => {
        if (allowAllocate) {
            setShouldMaintainFocus(true)
        }
    }, [allowAllocate])

    const handleArrowClick = React.useCallback((lane: 'left' | 'right', event: React.MouseEvent) => {
        event.preventDefault() // Prevenir que el botón tome el focus
        handleAddCarToLane(lane)
    }, [handleAddCarToLane])

    // Detectar clics fuera del área de allocator para desactivar el mantenimiento de focus
    React.useEffect(() => {
        // Escuchar solo mientras el input está habilitado y mantiene el focus
        if (!allowAllocate || !shouldMaintainFocus) {
            return
        }

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element
            // Verificar si el clic fue fuera del área del allocator
            const isAllocatorArea = target.closest('.allocator-area')
            if (!isAllocatorArea) {
                setShouldMaintainFocus(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [allowAllocate, shouldMaintainFocus])

    // Cleanup effect para el timeout de alerta y animationFrame
    React.useEffect(() => {
        return () => {
            if (alertTimeoutRef.current) {
                clearTimeout(alertTimeoutRef.current)
            }
            if (focusFrameRef.current) {
                cancelAnimationFrame(focusFrameRef.current)
            }
        }
    }, [])

    // Sincronizar ref con estado del input
    React.useEffect(() => {
        carInputValueRef.current = carInputValue
    }, [carInputValue])

    // Toggle fullscreen for viewer mode
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    // Evitar render antes de cargar campus desde localStorage
    if (!campusLoaded) {
        return (
            <div data-dismissal-view className={cn("w-full min-h-0 flex flex-1 flex-col items-center justify-center", className)}>
                <div className="text-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yankees-blue mx-auto"></div>
                    <p className="text-sm text-muted-foreground">Loading campus selection...</p>
                </div>
            </div>
        )
    }

    return (
        <div data-dismissal-view className={cn("w-full min-h-0 flex flex-1 flex-col", className)}>
            {/* Campus selection and early pickups */}
            <div className="flex items-center gap-2 md:gap-4 md:justify-between flex-shrink-0">
                <div className="min-w-0 flex-1 md:flex-none relative">
                    <FilterDropdown<string>
                        value={selectedCampus}
                        onChange={(value) => updateSelectedCampus(value)}
                        options={campusOptions?.map((c) => c.label) ?? []}
                        icon={MapPin}
                        label={t('campus.select')}
                        placeholder={t('campus.select')}
                        className="w-full md:w-64"
                        showAllOption={false}
                        optionCounts={carCountsByCampus}
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

                {/* Clear All Button - Currently disabled */}
                {allowDispatch && isCampusSelected && campusOptions?.some(c => c.value === selectedCampus) && (
                    <EarlyPickups campus={selectedCampus} timezone={campusOptions.find(c => c.value === selectedCampus)!.timezone} />
                )}
                {/* {allowDispatch && isCampusSelected && (
                    <Button
                        onClick={() => setShowClearDialog(true)}
                        disabled={isSubmitting || (leftLaneCars.length === 0 && rightLaneCars.length === 0)}
                        variant="destructive"
                        className="gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('dispatcher.clearAll')}</span>
                        <span className="sm:hidden">Clear</span>
                    </Button>
                )} */}
            </div>

            {/* Main Content Area - Takes remaining space */}
            <div className="flex-1 flex flex-col mt-4 mb-4 gap-4 min-h-0 relative">
                <div className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${!isCampusSelected ? 'pointer-events-none' : ''}`}>
                    <Road
                        leftLaneCars={leftLaneCars}
                        rightLaneCars={rightLaneCars}
                        mode={mode}
                        onRemoveCar={allowDispatch ? handleRemoveCar : undefined}
                        disableRemoval={isSubmitting}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={toggleFullscreen}
                        birthdayCarIds={birthdayCarIds}
                    />

                    {/* Overlay cuando no hay campus */}
                    {!isCampusSelected && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
                            <Card className="bg-white shadow-xl border-2 border-yankees-blue">
                                <CardContent className="flex items-center justify-center p-6">
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
                    )}
                </div>

                {/* Allocator Control with Finish Line - Responsive */}
                {allowAllocate && isCampusSelected && (
                    <div className="shrink-0 px-2">
                        <div className="flex justify-center">
                            <div className="allocator-area bg-white/90 w-full max-w-xs sm:max-w-sm backdrop-blur-md rounded-xl sm:rounded-2xl  border-white/30 relative overflow-hidden">
                                <div className="flex items-center gap-2 sm:gap-3 relative z-10 justify-center">
                                    {/* Left Arrow Button */}
                                    <Button
                                        aria-label={t('allocator.addToLeft')}
                                        onClick={(e) => handleArrowClick('left', e)}
                                        disabled={!carInputValue.trim() || isSubmitting}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:p-3 h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl shrink-0 shadow-md transition-colors duration-200 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </Button>

                                    {/* Car Input */}
                                    <Input
                                        ref={carInputRef}
                                        type="text"
                                        autoCapitalize="characters"
                                        maxLength={20}
                                        placeholder={bt('identifier')}
                                        aria-label={bt('identifier')}
                                        value={carInputValue}
                                        onChange={(e) => {
                                            updateCarInputValue(e.target.value)
                                        }}
                                        onFocus={handleInputFocus}
                                        onKeyDown={handleKeyPress}
                                        disabled={isSubmitting}
                                        className="text-center text-base sm:text-lg font-bold border-2 border-gray-300 focus:border-yankees-blue focus:ring-2 focus:ring-yankees-blue/20 h-10 sm:h-12 rounded-lg sm:rounded-xl shadow-sm bg-white disabled:opacity-50"
                                        autoFocus
                                    />

                                    {/* Right Arrow Button */}
                                    <Button
                                        aria-label={t('allocator.addToRight')}
                                        onClick={(e) => handleArrowClick('right', e)}
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
            </div>

            {/* Alert Component - Fixed at bottom right */}
            {alert.show && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
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

            {/* Clear All Confirmation Dialog */}
            <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('dispatcher.clearAllConfirm.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('dispatcher.clearAllConfirm.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t('dispatcher.clearAllConfirm.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleClearAllCars}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSubmitting ? 'Clearing...' : t('dispatcher.clearAllConfirm.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
