"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
import { ChevronDown, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type CampusLocation =
    "Poinciana Campus" | "Simpson Campus" | "Neptune Campus" |
    "Downtown Middle" | "Learning Center" | "Honduras" | "Puerto Rico"

const CAMPUS_LOCATIONS: readonly CampusLocation[] = [
    "Poinciana Campus", "Simpson Campus", "Neptune Campus",
    "Downtown Middle", "Learning Center", "Honduras", "Puerto Rico"
] as const

// Optimized responsive text component
const ResponsiveText = React.memo(({
    full, short
}: {
    full: string; short: string
}) => (
    <>
        <span className="hidden lg:inline">{full}</span>
        <span className="lg:hidden">{short}</span>
    </>
))
ResponsiveText.displayName = "ResponsiveText"

interface CampusSelectorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}

export function CampusSelector({
    value,
    onChange,
    placeholder,
    className = "",
    disabled = false
}: CampusSelectorProps) {
    const t = useTranslations('studentsManagement')

    const displayValue = value === "all"
        ? (placeholder || t('filters.campus.all'))
        : value

    const shortValue = value === "all"
        ? t('filters.campus.short')
        : value

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={`w-full justify-between border-2 border-yankees-blue hover:bg-yankees-blue/10 md:w-auto ${className}`}
                    aria-label="Filter by campus"
                    disabled={disabled}
                >
                    <div className="flex items-center">
                        <MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
                        <ResponsiveText
                            full={displayValue}
                            short={shortValue}
                        />
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{t('filters.campus.label')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {placeholder && (
                    <DropdownMenuItem onClick={() => onChange("all")}>
                        {placeholder}
                    </DropdownMenuItem>
                )}
                {CAMPUS_LOCATIONS.map((campus) => (
                    <DropdownMenuItem key={campus} onClick={() => onChange(campus)}>
                        {campus}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export { CAMPUS_LOCATIONS }
export type { CampusLocation as CampusLocationType }
