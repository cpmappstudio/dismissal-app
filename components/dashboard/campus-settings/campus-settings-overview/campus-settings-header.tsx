"use client";

import { Search, Filter, Grid3X3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CampusStatus } from "@/lib/campus-settings/campus-settings-overview";
import { CampusSettingsDialog } from "../campus-settings-dialog";

interface CampusSettingsHeaderProps {
    query: string;
    setQuery: (value: string) => void;
    isGridView: boolean;
    setIsGridView: (value: boolean) => void;
    statusFilter: CampusStatus | "all";
    setStatusFilter: (value: CampusStatus | "all") => void;
}

export function CampusSettingsHeader({
    query,
    setQuery,
    isGridView,
    setIsGridView,
    statusFilter,
    setStatusFilter,
}: CampusSettingsHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search campus by name"
                        aria-label="Search campus"
                        className="pl-10 pr-3 rounded-l bg-card h-9"
                    />
                </div>
            </div>
            <div className="flex items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="lg" className="h-9 bg-card">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48" align="end">
                        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => setStatusFilter("all")}
                            className={statusFilter === "all" ? "bg-accent" : ""}
                        >
                            All Campus
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setStatusFilter("active")}
                            className={statusFilter === "active" ? "bg-accent" : ""}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                Active
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setStatusFilter("inactive")}
                            className={statusFilter === "inactive" ? "bg-accent" : ""}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                                Inactive
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setStatusFilter("maintenance")}
                            className={statusFilter === "maintenance" ? "bg-accent" : ""}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                                Maintenance
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <div className="hidden md:inline-flex h-9 items-center rounded-lg bg-muted p-1">
                    <button
                        type="button"
                        onClick={() => setIsGridView(true)}
                        className={`inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-all ${isGridView
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        aria-pressed={isGridView}
                    >
                        <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsGridView(false)}
                        className={`inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-all ${!isGridView
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        aria-pressed={!isGridView}
                    >
                        <List className="h-4 w-4" />
                    </button>
                </div>
                <CampusSettingsDialog />
            </div>
        </div>
    );
}
