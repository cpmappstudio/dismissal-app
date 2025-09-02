"use client"

import * as React from "react"
import { Trash2, Clock, Users, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import { Car } from "./car"
import { useTranslations } from "next-intl"
import { CarData } from "./types"
import { LANE_COLORS } from "./constants"
import { formatTime, getStudentInitials } from "./utils"

interface CarCardProps {
    car: CarData
    onRemove?: (carId: string) => void
    showRemoveButton?: boolean
    lane: 'left' | 'right'
}

export const CarCard = React.memo<CarCardProps>(({ car, onRemove, showRemoveButton = false, lane }) => {
    const t = useTranslations('dismissal')

    // Helper function to get display name for multiple students
    // const getDisplayName = React.useMemo(() => {
    //     if (car.students.length === 1) {
    //         return car.students[0].name
    //     }
    //     if (car.students.length === 2) {
    //         return `${car.students[0].name} y ${car.students[1].name}`
    //     }
    //     return `${car.students[0].name} +${car.students.length - 1} más`
    // }, [car.students])

    // Get lane colors from constants
    const laneColors = LANE_COLORS[lane]

    return (
        <div className="relative flex justify-center">
            <Drawer>
                <DrawerTrigger asChild>
                    <div className="relative cursor-pointer hover:scale-105 transition-transform duration-200 group">
                        {/* SVG Car with dynamic color */}
                        <Car
                            size="xl"
                            color={car.imageColor}
                            className="filter drop-shadow-lg hover:drop-shadow-xl transition-all duration-200"
                        />

                        {/* Combined Car Number Badge and Remove Button */}
                        <div className={`absolute -top-2 -right-2 ${laneColors.badge} text-white text-sm font-bold rounded-full shadow-lg z-20 flex items-center`}>
                            {showRemoveButton && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onRemove?.(car.id)
                                    }}
                                    className="p-1.5 hover:text-red-500 rounded-l-full transition-colors duration-200"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                            <span className={`px-2 text-xl py-1 ${showRemoveButton ? 'rounded-r-full' : 'rounded-full px-3'}`}>
                                {car.carNumber}
                            </span>
                        </div>
                    </div>
                </DrawerTrigger>

                <DrawerContent>
                    <div className="mx-auto w-full max-w-md">
                        <DrawerHeader>
                            <DrawerTitle className={`text-2xl font-black ${laneColors.textColor} flex items-center gap-2`}>
                                <div className={`${laneColors.badge} text-white px-3 py-1 rounded-lg text-xl`}>
                                    #{car.carNumber}
                                </div>
                                {t('car.information')}
                            </DrawerTitle>
                            <DrawerDescription>
                                {t('car.details')}
                            </DrawerDescription>
                        </DrawerHeader>

                        <div className="p-4 space-y-6">
                            {/* Car SVG Display */}
                            <div className="flex justify-center">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <Car
                                        size="lg"
                                        color={car.imageColor}
                                    />
                                </div>
                            </div>

                            {/* Time and Position Info */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-600" />
                                    <span className="text-sm font-medium">{t('car.arrivalTime')}</span>
                                </div>
                                <Badge variant="outline">{formatTime(car.assignedTime)}</Badge>
                            </div>

                            {/* Students Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-gray-600" />
                                    <h3 className="text-lg font-semibold">
                                        {t('car.students')} ({car.students.length})
                                    </h3>
                                </div>

                                <div className="space-y-3">
                                    {car.students.map((student) => (
                                        <div key={student.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                                            <Avatar className={`w-12 h-12 ${laneColors.background}`}>
                                                <AvatarImage src={student.imageUrl} alt={student.name} />
                                                <AvatarFallback className={`text-sm font-bold ${laneColors.textColor} bg-transparent`}>
                                                    {getStudentInitials(student.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900">{student.name}</div>
                                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                                    <GraduationCap className="h-3 w-3" />
                                                    {student.grade || `${t('car.grade')} 5`}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DrawerFooter>
                            <DrawerClose asChild>
                                <Button variant="outline">{t('car.close')}</Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
})

CarCard.displayName = 'CarCard'
