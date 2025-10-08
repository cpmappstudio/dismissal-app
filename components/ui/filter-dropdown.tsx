"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FilterDropdownProps<T extends string = string> {
    value: T | ""
    onChange: (value: T | "") => void
    options: readonly T[]
    icon: LucideIcon
    label: string
    placeholder: string
    placeholderShort?: string
    className?: string
    disabled?: boolean
    showAllOption?: boolean
    contentWidth?: string
    optionCounts?: Record<string, number>
}

export function FilterDropdown<T extends string>({
    value,
    onChange,
    options,
    icon: Icon,
    label,
    placeholder,
    placeholderShort,
    className = "",
    disabled = false,
    showAllOption = true,
    contentWidth = "w-48",
    optionCounts
}: FilterDropdownProps<T>) {
    const displayValue = !value || value === "all" ? placeholder : value
    const displayValueShort = !value || value === "all"
        ? (placeholderShort || placeholder)
        : value

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={`w-full justify-between overflow-hidden border-2 border-yankees-blue hover:bg-yankees-blue/10 md:w-auto ${className}`}
                    disabled={disabled}
                    aria-label={`Filter by ${label.toLowerCase()}`}
                >
                    <div className="flex items-center">
                        <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                        <span className="hidden lg:inline">{displayValue}</span>
                        <span className="lg:hidden">{displayValueShort}</span>
                    </div>
                    {/* <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" /> */}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={contentWidth}>
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {showAllOption && (
                    <DropdownMenuItem onClick={() => onChange("")}>
                        {placeholder}
                    </DropdownMenuItem>
                )}
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option}
                        onClick={() => onChange(option)}
                        className="flex items-center justify-between"
                    >
                        <span>{option}</span>
                        {optionCounts && optionCounts[option] !== undefined && (
                            <span className="ml-2 text-xs text-muted-foreground">
                                {optionCounts[option]}
                            </span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}