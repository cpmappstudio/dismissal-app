"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Lane } from "./lane"
import { CarData, LaneType, ModeType } from "./types"

interface RoadProps {
    leftLaneCars: CarData[]
    rightLaneCars: CarData[]
    mode: ModeType
    onRemoveCar: (carId: string) => void
    className?: string
}

export const Road = React.memo<RoadProps>(({ leftLaneCars, rightLaneCars, mode, onRemoveCar, className }) => {
    return (
        <div className="flex-1 min-h-0" style={{ marginBottom: mode === 'allocator' ? '6rem' : '0' }}>
            <Card className="border-2 border-yankees-blue flex flex-col h-[calc(100vh-14rem)] max-h-[calc(100vh-14rem)] py-0 overflow-hidden relative" style={{ backgroundColor: '#9CA3AF' }}>
                <CardContent
                    className="flex-1 overflow-y-scroll min-h-0 p-0 relative"
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#D1D5DB #9CA3AF'
                    }}
                >
                    <div className="min-h-full relative flex">
                        {/* Road Divider Line - Center line that moves with scroll */}
                        <div
                            className="absolute left-1/2 top-0 bottom-16 w-2 -translate-x-1/2 z-10"
                            style={{
                                background: `repeating-linear-gradient(
                                    to bottom,
                                    #ffffff 0px,
                                    #ffffff 20px,
                                    transparent 20px,
                                    transparent 40px
                                )`
                            }}
                        />

                        {/* Left Lane */}
                        <Lane
                            cars={leftLaneCars}
                            lane="left"
                            mode={mode}
                            onRemoveCar={onRemoveCar}
                        />

                        {/* Right Lane */}
                        <Lane
                            cars={rightLaneCars}
                            lane="right"
                            mode={mode}
                            onRemoveCar={onRemoveCar}
                        />

                        {/* Unified Zebra Pattern at bottom - spans both lanes */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 z-5" style={{ backgroundColor: '#9CA3AF' }}>
                            {/* Top border line */}
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-white"></div>
                            {/* Bottom border line */}
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
                            {/* Vertical lines pattern - Much thicker */}
                            <div
                                className="absolute left-0 right-0 top-2 bottom-2"
                                style={{
                                    background: `repeating-linear-gradient(
                                        90deg,
                                        transparent 0px,
                                        transparent 20px,
                                        #ffffff 20px,
                                        #ffffff 36px
                                    )`
                                }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
})

Road.displayName = 'Road'
