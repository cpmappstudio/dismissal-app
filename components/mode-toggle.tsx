"use client"

import * as React from "react"
import { Moon, Sun, Monitor, ChevronsUpDown } from "lucide-react"
import { useTheme } from "next-themes"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()

    const getThemeLabel = () => {
        switch (theme) {
            case "light":
                return "Light"
            case "dark":
                return "Dark"
            case "system":
                return "System"
            default:
                return "Theme"
        }
    }

    const getThemeIcon = () => {
        switch (theme) {
            case "light":
                return <Sun className="h-4 w-4" />
            case "dark":
                return <Moon className="h-4 w-4" />
            case "system":
                return <Monitor className="h-4 w-4" />
            default:
                return (
                    <>
                        <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                        <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                    </>
                )
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center justify-between w-full px-2 py-1.5 text-left text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-2">
                        {getThemeIcon()}
                        <span className="font-medium">{getThemeLabel()}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto h-4 w-4" />
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-full">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
