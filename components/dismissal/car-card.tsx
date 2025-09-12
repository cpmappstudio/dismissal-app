"use client"

import * as React from "react"
import { Trash2, Users, GraduationCap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
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
    isViewerMode?: boolean
}

export const CarCard = React.memo<CarCardProps>(({ car, onRemove, showRemoveButton = false, lane, isViewerMode = false }) => {
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
        <div className={`relative z-30 ${isViewerMode ? 'flex flex-col items-center justify-center mx-8 mt-8 md:mt-0' : 'flex justify-center'}`}>
            <Drawer>
                <DrawerTrigger asChild>
                    <div className="relative cursor-pointer hover:scale-105 transition-transform duration-200 group z-30">
                        {/* SVG Car with dynamic color */}
                        <Car
                            size="lg"
                            // color={car.imageColor}
                            color="#A6A6A6"
                            className="filter drop-shadow-lg hover:drop-shadow-xl transition-all duration-200"
                            isViewer={isViewerMode}
                        />

                        {/* Combined Car Number Badge and Remove Button */}
                        <div className={`absolute -top-2 -right-2 ${laneColors.badge} text-white text-sm font-bold rounded-full shadow-lg z-50 flex items-center`}>
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

                {/* Students Information - Only shown in Viewer Mode */}
                {isViewerMode && (
                    <div className="max-h-16 xl:max-h-32 overflow-y-auto bg-transparent z-30 relative -mt-10 xl:-mt-14"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}>
                        <div className="flex flex-col space-y-2">
                            {car.students.map((student) => (
                                <div key={student.id} className="flex items-center gap-2">
                                    <Avatar className={`w-8 h-8 ${laneColors.background}`}>
                                        <AvatarImage src={student.imageUrl} alt={student.name} />
                                        <AvatarFallback className={`text-xs font-bold ${laneColors.textColor} bg-transparent`}>
                                            {getStudentInitials(student.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="-ml-1">
                                        <div className="text-sm text-white font-medium">
                                            {student.name}
                                        </div>
                                        <div className="text-xs text-white/80">
                                            {student.grade || `${t('car.grade')} 5`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <DrawerContent>
                    <div className="mx-auto w-full max-w-md">
                        <DrawerHeader>
                            <DrawerTitle className={`text-2xl font-black ${laneColors.textColor} flex items-center gap-2`}>
                                <div className={`${laneColors.badge} text-white px-3 py-1 rounded-lg text-xl`}>
                                    #{car.carNumber}
                                </div>
                                {formatTime(car.assignedTime)}
                            </DrawerTitle>
                        </DrawerHeader>

                        <div className="p-4 space-y-6">
                            {/* Car SVG Display */}
                            {/* <div className="flex justify-center">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <Car
                                        size="lg"
                                        color={car.imageColor}
                                    />
                                </div>
                            </div> */}

                            {/* Students Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-gray-600" />
                                    <h3 className="text-lg font-semibold">
                                        {t('car.students')} ({car.students.length})
                                    </h3>
                                </div>

                                <div className="space-y-3 pr-2"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#D1D5DB #F3F4F6' }}>
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
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
})

CarCard.displayName = 'CarCard'
