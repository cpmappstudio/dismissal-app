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

export interface StudentData {
    id: string
    name: string
    grade?: string
    imageUrl?: string
}

export interface CarData {
    id: string
    carNumber: number
    lane: 'left' | 'right'
    position: number
    assignedTime: Date
    students: StudentData[] // Cambio de studentName a students array
    campus: string
    imageColor: string // Cambio de imageUrl a imageColor
}

interface CarCardProps {
    car: CarData
    onRemove?: (carId: string) => void
    showRemoveButton?: boolean
    lane: 'left' | 'right'
}

export function CarCard({ car, onRemove, showRemoveButton = false, lane }: CarCardProps) {
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // Helper function to get initials from student name
    const getStudentInitials = (name: string) => {
        return name.split(' ').map((n: string) => n[0]).join('')
    }

    // Helper function to get display name for multiple students
    const getDisplayName = () => {
        if (car.students.length === 1) {
            return car.students[0].name
        }
        if (car.students.length === 2) {
            return `${car.students[0].name} y ${car.students[1].name}`
        }
        return `${car.students[0].name} +${car.students.length - 1} más`
    }

    // Define colors based on lane
    const colors = {
        left: {
            primary: 'text-blue-600',
            background: 'bg-blue-100',
            textColor: 'text-blue-600',
            badge: 'bg-blue-500',
            carColor: '#3b82f6' // Blue for left lane
        },
        right: {
            primary: 'text-green-600',
            background: 'bg-green-100',
            textColor: 'text-green-600',
            badge: 'bg-green-500',
            carColor: '#10b981' // Green for right lane
        }
    }

    const laneColors = colors[lane]

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

                        {/* Car Number Badge - Floating */}
                        <div className={`absolute -top-4 -right-4 ${laneColors.badge} text-white text-base font-bold px-3 py-2 rounded-full shadow-xl`}>
                            {car.carNumber}
                        </div>

                        {/* Remove button for dispatcher mode */}
                        {showRemoveButton && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onRemove?.(car.id)
                                }}
                                size="sm"
                                variant="destructive"
                                className="absolute -top-5 -left-5 h-10 w-10 p-0 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-20"
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </DrawerTrigger>

                <DrawerContent>
                    <div className="mx-auto w-full max-w-md">
                        <DrawerHeader>
                            <DrawerTitle className={`text-2xl font-black ${laneColors.textColor} flex items-center gap-2`}>
                                <div className={`${laneColors.badge} text-white px-3 py-1 rounded-lg text-xl`}>
                                    #{car.carNumber}
                                </div>
                                Car Information
                            </DrawerTitle>
                            <DrawerDescription>
                                Detalles del vehículo y estudiantes asignados
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
                                    <span className="text-sm font-medium">Hora de llegada</span>
                                </div>
                                <Badge variant="outline">{formatTime(car.assignedTime)}</Badge>
                            </div>

                            {/* Students Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-gray-600" />
                                    <h3 className="text-lg font-semibold">
                                        Estudiantes ({car.students.length})
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
                                                    {student.grade || 'Grado 5'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DrawerFooter>
                            <DrawerClose asChild>
                                <Button variant="outline">Cerrar</Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
}
