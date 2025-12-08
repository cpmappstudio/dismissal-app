"use client"

import * as React from "react"
import { UserButton, useUser } from "@clerk/nextjs"
import { Skeleton } from "@/components/ui/skeleton"

interface UserButtonWrapperProps {
    showName?: boolean
    collapsed?: boolean
}

export function UserButtonWrapper({ showName = true, collapsed = false }: UserButtonWrapperProps) {
    const { isLoaded } = useUser()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Contenedor con dimensiones fijas para evitar layout shifting
    const containerStyle = {
        padding: !collapsed ? "0.62rem 0.5rem" : "0.1rem",
        minHeight: !collapsed ? "3.6rem" : "2.5rem",
    }

    // Durante SSR y primera carga, mostrar solo el contenedor
    if (!mounted || !isLoaded) {
        return (
            <div
                className="w-full"
                style={containerStyle}
                suppressHydrationWarning
            >
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    {showName && !collapsed && (
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div
            className="w-full"
            style={containerStyle}
        >
            <UserButton
                appearance={{
                    elements: {
                        userButtonBox: {
                            flexDirection: "row-reverse",
                            textAlign: "left",
                            width: "100%",
                        },
                        userButtonPopoverCard: { pointerEvents: "initial" },
                        userButtonOuterIdentifier: { color: "white" }
                    },
                }}
                showName={showName}
            />
        </div>
    )
}
