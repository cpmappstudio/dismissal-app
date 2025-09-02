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
    const isViewer = mode === 'viewer'

    return (
        <div className="flex-1 min-h-0" style={{ marginBottom: mode === 'allocator' ? '6rem' : '0' }}>
            <Card className={`border-2 border-yankees-blue flex flex-col py-0 overflow-hidden relative ${mode === 'viewer' || mode === 'dispatcher'
                ? 'h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)]'
                : 'h-[calc(100vh-14rem)] max-h-[calc(100vh-14rem)]'
                }`} style={{ backgroundColor: '#9CA3AF' }}>
                <CardContent
                    className={`flex-1 min-h-0 p-0 relative ${isViewer ? 'overflow-x-scroll overflow-y-hidden' : 'overflow-y-scroll'}`}
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#D1D5DB #9CA3AF'
                    }}
                >
                    <div className={`relative ${isViewer ? 'min-w-max h-full flex flex-col' : 'min-h-full flex'}`}>
                        {/* Road Divider Line - Conditional orientation */}
                        <div
                            className={`absolute z-5 ${isViewer
                                ? 'top-1/2 left-16 h-2 -translate-y-1/2 w-full'
                                : 'left-1/2 top-0 bottom-16 w-2 -translate-x-1/2'
                                }`}
                            style={{
                                background: isViewer
                                    ? `repeating-linear-gradient(
                                        to right,
                                        #ffffff 0px,
                                        #ffffff 20px,
                                        transparent 20px,
                                        transparent 40px
                                    )`
                                    : `repeating-linear-gradient(
                                        to bottom,
                                        #ffffff 0px,
                                        #ffffff 20px,
                                        transparent 20px,
                                        transparent 40px
                                    )`
                            }}
                        />

                        {/* Lanes - Conditional layout */}
                        <Lane
                            cars={leftLaneCars}
                            lane="left"
                            mode={mode}
                            onRemoveCar={onRemoveCar}
                        />

                        <Lane
                            cars={rightLaneCars}
                            lane="right"
                            mode={mode}
                            onRemoveCar={onRemoveCar}
                        />

                        {/* Zebra Pattern - Conditional position and orientation */}
                        <div className={`absolute z-5 ${isViewer
                            ? 'top-0 bottom-0 left-0 w-16'
                            : 'bottom-0 left-0 right-0 h-16'
                            }`} style={{ backgroundColor: '#9CA3AF' }}>
                            {/* Border lines */}
                            <div className={`absolute bg-white ${isViewer
                                ? 'top-0 bottom-0 right-0 w-0.5'
                                : 'top-0 left-0 right-0 h-0.5'
                                }`}></div>
                            <div className={`absolute bg-white ${isViewer
                                ? 'top-0 bottom-0 left-0 w-0.5'
                                : 'bottom-0 left-0 right-0 h-0.5'
                                }`}></div>
                            {/* Lines pattern */}
                            <div
                                className={`absolute ${isViewer
                                    ? 'top-2 bottom-2 left-0 right-2'
                                    : 'left-0 right-0 top-2 bottom-2'
                                    }`}
                                style={{
                                    background: isViewer
                                        ? `repeating-linear-gradient(
                                            to bottom,
                                            transparent 0px,
                                            transparent 20px,
                                            #ffffff 20px,
                                            #ffffff 36px
                                        )`
                                        : `repeating-linear-gradient(
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
