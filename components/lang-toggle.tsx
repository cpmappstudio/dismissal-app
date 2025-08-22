"use client"

import * as React from "react"
import { Languages, ChevronsUpDown } from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface LangToggleProps {
    showText?: boolean
}

export function LangToggle({ showText = true }: LangToggleProps) {
    const [mounted, setMounted] = React.useState(false)
    const [currentLang] = React.useState("en") // Estado temporal hasta implementar funcionalidad

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Optimización: Solo recalcular cuando cambia el idioma
    const langLabel = React.useMemo(() => {
        switch (currentLang) {
            case "en": return "English"
            case "es": return "Español"
            default: return "Language"
        }
    }, [currentLang])

    const langIcon = React.useMemo(() => {
        return <Languages className="h-4 w-4" />
    }, [])

    // Durante hydration: valores por defecto
    if (!mounted) {
        return (
            <div className={`flex items-center ${showText ? 'justify-between w-full px-2' : 'justify-center w-8 h-8'} py-1.5 text-left text-sm rounded-md`}>
                <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    {showText && <span className="font-medium">English</span>}
                </div>
                {showText && <ChevronsUpDown className="ml-auto h-4 w-4" />}
            </div>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className={`flex items-center ${showText ? 'justify-between w-full px-2' : 'justify-center w-8 h-8'} py-1.5 text-left text-sm cursor-pointer hover:bg-[oklch(0.45_0.0568_265.16)] hover:text-white rounded-md transition-colors`}>
                    <div className="flex items-center gap-2">
                        {langIcon}
                        {showText && <span className="font-medium">{langLabel}</span>}
                    </div>
                    {showText && <ChevronsUpDown className="ml-auto h-4 w-4" />}
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-full">
                <DropdownMenuItem>
                    <Languages className="mr-2 h-4 w-4" />
                    English
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Languages className="mr-2 h-4 w-4" />
                    Español
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
