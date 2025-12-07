"use client";

import { Building2, School, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CampusHero, CampusIconKey } from "@/lib/campus-settings/campus-settings-overview";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Image from "next/image";

const HERO_ICON_COMPONENTS: Record<CampusIconKey, LucideIcon> = {
    building: Building2,
    school: School,
    campus: GraduationCap,
};

interface CampusHeroProps {
    hero?: CampusHero;
    name: string;
    logoStorageId?: Id<"_storage">;
}

type CampusHeroSmallProps = CampusHeroProps;

export function CampusHero({ hero, name, logoStorageId }: CampusHeroProps) {
    // Get image URL from Convex storage if storageId is provided
    const campusLogoUrl = useQuery(
        api.campus.getLogoUrl,
        logoStorageId ? { storageId: logoStorageId } : "skip"
    );

    // If there's an image from storage, prioritize it
    if (campusLogoUrl) {
        return (
            <div className="relative aspect-[16/9] w-full overflow-hidden">
                <Image
                    src={campusLogoUrl}
                    alt={name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
            </div>
        );
    }

    if (!hero) {
        return (
            <div className="relative aspect-[16/9] w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20" />
                <div className="relative flex h-full items-center justify-center">
                    <Building2 className="h-12 w-12 text-primary" aria-hidden />
                </div>
            </div>
        );
    }

    switch (hero.type) {
        case "icon": {
            const Icon = HERO_ICON_COMPONENTS[hero.iconName] ?? Building2;
            return (
                <div className={`relative aspect-[16/9] w-full overflow-hidden ${hero.backgroundClass ?? "bg-primary/10"}`}>
                    <div className="absolute inset-0 opacity-40 transition group-hover:opacity-60" />
                    <div className="relative flex h-full items-center justify-center">
                        <Icon className={`h-12 w-12 ${hero.iconClass ?? "text-primary"}`} aria-hidden />
                    </div>
                </div>
            );
        }
        case "image": {
            return (
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url('${hero.imageUrl}')` }}
                        role="img"
                        aria-label={hero.alt ?? name}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
                </div>
            );
        }
        case "initials": {
            return (
                <div className={`relative aspect-[16/9] w-full overflow-hidden ${hero.backgroundClass ?? "bg-primary"}`}>
                    <div className="absolute inset-0 bg-black/5" />
                    <div className="relative flex h-full flex-col items-center justify-center gap-1">
                        <span className={`text-3xl font-semibold tracking-[0.2em] ${hero.textClass ?? "text-white"}`}>
                            {hero.label}
                        </span>
                        {hero.helperText ? (
                            <span className="text-xs uppercase tracking-wide text-white/80">
                                {hero.helperText}
                            </span>
                        ) : null}
                    </div>
                </div>
            );
        }
        default:
            return null;
    }
}

export function CampusHeroSmall({ hero, name, logoStorageId }: CampusHeroSmallProps) {
    const campusLogoUrl = useQuery(
        api.campus.getLogoUrl,
        logoStorageId ? { storageId: logoStorageId } : "skip"
    );

    if (campusLogoUrl) {
        return (
            <div className="relative h-full w-full overflow-hidden">
                <Image
                    src={campusLogoUrl}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="120px"
                />
            </div>
        );
    }

    if (!hero) {
        return (
            <div className="relative h-full w-full bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20">
                <div className="flex h-full items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" aria-hidden />
                </div>
            </div>
        );
    }

    // Similar switch for small hero (simplified)
    switch (hero.type) {
        case "icon": {
            const Icon = HERO_ICON_COMPONENTS[hero.iconName] ?? Building2;
            return (
                <div className={`relative h-full w-full ${hero.backgroundClass ?? "bg-primary/10"}`}>
                    <div className="flex h-full items-center justify-center">
                        <Icon className={`h-6 w-6 ${hero.iconClass ?? "text-primary"}`} aria-hidden />
                    </div>
                </div>
            );
        }
        case "initials": {
            return (
                <div className={`relative h-full w-full ${hero.backgroundClass ?? "bg-primary"}`}>
                    <div className="flex h-full flex-col items-center justify-center gap-1">
                        <span className={`text-lg font-semibold tracking-[0.1em] ${hero.textClass ?? "text-white"}`}>
                            {hero.label}
                        </span>
                    </div>
                </div>
            );
        }
        default:
            return null;
    }
}
