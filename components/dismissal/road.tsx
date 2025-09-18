"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Maximize, Minimize } from "lucide-react"
import { Lane } from "./lane"
import { CarData, ModeType } from "./types"
import { ScrollableContainer } from "./scrollable-container"
import "./road.css"

interface RoadProps {
    leftLaneCars: CarData[]
    rightLaneCars: CarData[]
    mode: ModeType
    onRemoveCar: (carId: string) => void
    isFullscreen?: boolean
    onToggleFullscreen?: () => void
    className?: string
}

export const Road = React.memo<RoadProps>(({ leftLaneCars, rightLaneCars, mode, onRemoveCar, isFullscreen = false, onToggleFullscreen }) => {
    const t = useTranslations('common')
    const isViewer = mode === 'viewer'

    // Handle ESC key to exit fullscreen
    React.useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullscreen && onToggleFullscreen) {
                onToggleFullscreen()
            }
        }

        if (isFullscreen) {
            document.addEventListener('keydown', handleEscKey)
            return () => document.removeEventListener('keydown', handleEscKey)
        }
    }, [isFullscreen, onToggleFullscreen])



    return (
        <div className={`flex-1 min-h-0 ${isFullscreen ? 'fixed inset-0 z-[9999] bg-white' : ''}`} style={{ marginBottom: mode === 'allocator' ? '6rem' : '0' }}>
            <Card className={`border-2 border-yankees-blue flex flex-col py-0 overflow-hidden relative ${isFullscreen
                ? 'h-screen max-h-screen'
                : mode === 'viewer' || mode === 'dispatcher'
                    ? 'h-[calc(100vh-9rem)] md:max-w-[calc(100vw-20rem)] max-h-[calc(100vh-9rem)]'
                    : 'h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)]'
                }`} style={{ backgroundColor: '#9CA3AF' }}>

                {/* Fullscreen Toggle Button - Only visible in viewer mode */}
                {isViewer && onToggleFullscreen && (
                    <Button
                        onClick={onToggleFullscreen}
                        variant="secondary"
                        size="sm"
                        title={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
                        className="absolute top-2 right-2 z-50 bg-white/90 hover:bg-white border border-gray-300 p-2 h-8 w-8 rounded-lg shadow-sm transition-all duration-200"
                    >
                        {isFullscreen ? (
                            <Minimize className="h-4 w-4 text-gray-700" />
                        ) : (
                            <Maximize className="h-4 w-4 text-gray-700" />
                        )}
                    </Button>
                )}

                <ScrollableContainer
                    isViewer={isViewer}
                    className="flex-1 min-h-0 p-0 relative"
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
                </ScrollableContainer>
            </Card>
        </div>
    )
})

Road.displayName = 'Road'
