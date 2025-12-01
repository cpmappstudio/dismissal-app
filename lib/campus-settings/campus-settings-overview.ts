import type { Doc, Id } from "@/convex/_generated/dataModel";

export type CampusSettingsDoc = Doc<"campusSettings">;

export type CampusStatus = "active" | "inactive" | "maintenance";

export type CampusIconKey = "building" | "school" | "campus";

export type CampusHero =
    | { type: "icon"; iconName: CampusIconKey; backgroundClass?: string; iconClass?: string }
    | { type: "image"; imageUrl: string; alt?: string }
    | { type: "initials"; label: string; backgroundClass?: string; textClass?: string; helperText?: string };

export interface CampusSettingsOverview {
    id: string;
    name: string;
    description?: string;
    itemCount?: number;
    status?: CampusStatus;
    hero?: CampusHero;
    logoStorageId?: Id<"_storage">;
}

/**
 * Mapper: Converts Doc<"campusSettings"> to CampusSettingsOverview
 * Adapts fields according to the schema
 */
export function mapCampusSettingsDocToOverview(campus: CampusSettingsDoc): CampusSettingsOverview {
    const itemCount = campus.metrics?.totalStudents ?? campus.metrics?.activeStudents;
    const location = campus.address
        ? [campus.address.city, campus.address.state, campus.address.country].filter(Boolean).join(", ")
        : undefined;

    return {
        id: String(campus._id),
        name: campus.campusName,
        description: location ?? campus.code ?? undefined,
        itemCount,
        status: campus.status,
        logoStorageId: campus.logoStorageId,
        hero: {
            type: "initials",
            label: extractInitials(campus.campusName),
            backgroundClass: "bg-primary/90",
            textClass: "text-white",
        },
    };
}

function extractInitials(name: string) {
    const words = name.trim().split(/\s+/);

    if (words.length === 0) {
        return "C";
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    const first = words[0]?.[0] ?? "";
    const last = words[words.length - 1]?.[0] ?? "";

    return `${first}${last}`.toUpperCase();
}
