"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SelectDropdownProps {
    options: { value: string; label: string }[]
    value?: string
    onValueChange: (value: string) => void
    placeholder?: string
    label?: string
    className?: string
    disabled?: boolean
}

export function SelectDropdown({
    options,
    value,
    onValueChange,
    placeholder = "Select option...",
    label,
    className,
    disabled = false,
}: SelectDropdownProps) {
    const [open, setOpen] = React.useState(false)
    const selectedOption = options.find((option) => option.value === value)

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn("w-full justify-between", className)}
                    disabled={disabled}
                >
                    <span className="truncate text-left">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-56 max-h-[300px] overflow-y-auto"
                align="start"
                side="bottom"
                sideOffset={4}
            >
                {label && (
                    <>
                        <DropdownMenuLabel>{label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                    </>
                )}

                {/* Clear option */}
                {value && (
                    <>
                        <DropdownMenuItem
                            onClick={() => {
                                onValueChange("")
                                setOpen(false)
                            }}
                            className="text-muted-foreground"
                        >
                            <span>Clear selection</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}

                {/* Options */}
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => {
                            onValueChange(option.value)
                            setOpen(false)
                        }}
                        className={cn(
                            "flex items-center justify-between cursor-pointer",
                            value === option.value && "bg-accent"
                        )}
                    >
                        <span className="truncate">{option.label}</span>
                        {value === option.value && (
                            <Check className="ml-2 h-4 w-4 shrink-0" />
                        )}
                    </DropdownMenuItem>
                ))}

                {options.length === 0 && (
                    <DropdownMenuItem disabled>
                        No options available
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}