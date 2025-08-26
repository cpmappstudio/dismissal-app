"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Plus,
    Search,
    Clock,
    Car,
    Users,
    AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CarControlPanelProps {
    mode: 'allocator' | 'dispatcher'
    onAddCar?: (carNumber: number, lane: 'left' | 'right') => void
    onRemoveCar?: (carId: string) => void
    totalCars: number
    leftLaneCars: number
    rightLaneCars: number
    className?: string
}

export function CarControlPanel({
    mode,
    onAddCar,
    onRemoveCar,
    totalCars,
    leftLaneCars,
    rightLaneCars,
    className
}: CarControlPanelProps) {
    const [carNumber, setCarNumber] = React.useState("")
    const [selectedLane, setSelectedLane] = React.useState<'left' | 'right'>('right')

    const handleAddCar = () => {
        const number = parseInt(carNumber)
        if (number && number > 0) {
            onAddCar?.(number, selectedLane)
            setCarNumber("")
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddCar()
        }
    }

    return (
        <Card className={cn("w-full", className)}>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                    <Car className="w-5 h-5" />
                    {mode === 'allocator' ? 'Car Assignment' : 'Car Dispatch'}
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yankees-blue">{totalCars}</div>
                        <div className="text-xs text-muted-foreground">Total Cars</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{leftLaneCars}</div>
                        <div className="text-xs text-muted-foreground">Left Lane</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{rightLaneCars}</div>
                        <div className="text-xs text-muted-foreground">Right Lane</div>
                    </div>
                </div>

                {mode === 'allocator' && (
                    <>
                        {/* Car Number Input */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Car Number</label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Enter car #"
                                    value={carNumber}
                                    onChange={(e) => setCarNumber(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="flex-1 text-lg text-center font-bold border-2"
                                    min="1"
                                />
                                <Button
                                    onClick={handleAddCar}
                                    disabled={!carNumber}
                                    className="px-6 bg-yankees-blue hover:bg-yankees-blue/90"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Lane Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Assign to Lane</label>
                            <div className="flex gap-2">
                                <Button
                                    variant={selectedLane === 'left' ? 'default' : 'outline'}
                                    onClick={() => setSelectedLane('left')}
                                    className={cn(
                                        "flex-1 gap-2",
                                        selectedLane === 'left' && "bg-blue-600 hover:bg-blue-700"
                                    )}
                                >
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    Left Lane
                                </Button>
                                <Button
                                    variant={selectedLane === 'right' ? 'default' : 'outline'}
                                    onClick={() => setSelectedLane('right')}
                                    className={cn(
                                        "flex-1 gap-2",
                                        selectedLane === 'right' && "bg-green-600 hover:bg-green-700"
                                    )}
                                >
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    Right Lane
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {mode === 'dispatcher' && (
                    <div className="space-y-4">
                        {/* Quick Actions */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Quick Actions</label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Clock className="w-4 h-4" />
                                    Clear Next
                                </Button>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Users className="w-4 h-4" />
                                    Emergency
                                </Button>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                                <div className="text-xs text-orange-800">
                                    <p className="font-medium">Dispatcher Mode</p>
                                    <p>Click on cars when they pick up students and leave</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Lane Balance Indicator */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Lane Balance</span>
                        <span>{Math.abs(leftLaneCars - rightLaneCars)} difference</span>
                    </div>
                    <div className="flex gap-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="bg-blue-500 transition-all duration-300"
                            style={{ width: totalCars > 0 ? `${(leftLaneCars / totalCars) * 100}%` : '50%' }}
                        />
                        <div
                            className="bg-green-500 transition-all duration-300"
                            style={{ width: totalCars > 0 ? `${(rightLaneCars / totalCars) * 100}%` : '50%' }}
                        />
                    </div>
                </div>

                {/* Status */}
                <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <Badge
                            variant={totalCars > 0 ? "default" : "secondary"}
                            className={totalCars > 0 ? "bg-green-600" : ""}
                        >
                            {totalCars > 0 ? "Active" : "Idle"}
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
