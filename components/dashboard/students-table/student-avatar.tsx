"use client"

import * as React from "react"
import { useQuery } from "convex/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface StudentAvatarProps {
    avatarStorageId?: Id<"_storage">
    fallbackUrl?: string
    firstName: string
    lastName: string
    className?: string
    size?: "sm" | "md" | "lg"
}

const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8 sm:h-10 sm:w-10",
    lg: "h-16 w-16"
}

export function StudentAvatar({
    avatarStorageId,
    fallbackUrl,
    firstName,
    lastName,
    className = "",
    size = "md"
}: StudentAvatarProps) {
    // Only fetch avatar URL from Convex if we have a storage ID
    const avatarUrl = useQuery(
        api.students.getAvatarUrl,
        avatarStorageId ? { storageId: avatarStorageId } : "skip"
    )

    // Debug logs
    React.useEffect(() => {
        console.log(`🔍 StudentAvatar Debug - ${firstName} ${lastName}:`, {
            avatarStorageId,
            avatarUrl,
            fallbackUrl,
            hasStorageId: !!avatarStorageId,
            hasAvatarUrl: !!avatarUrl
        })
    }, [avatarStorageId, avatarUrl, fallbackUrl, firstName, lastName])

    // Generate initials
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`

    // Determine the image source to use
    const imageSrc = React.useMemo(() => {
        if (avatarStorageId && avatarUrl) {
            console.log(`✅ Using Convex storage URL for ${firstName} ${lastName}:`, avatarUrl)
            return avatarUrl
        }
        if (fallbackUrl) {
            console.log(`⚠️ Using fallback URL for ${firstName} ${lastName}:`, fallbackUrl)
            return fallbackUrl
        }
        // Generate fallback avatar
        const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`
        return dicebearUrl
    }, [avatarStorageId, avatarUrl, fallbackUrl, firstName, lastName])

    return (
        <Avatar className={`${sizeClasses[size]} flex-shrink-0 ${className}`}>
            <AvatarImage
                src={imageSrc}
                alt={`${firstName} ${lastName}`}
                loading="lazy"
            />
            <AvatarFallback className="text-xs">
                {initials}
            </AvatarFallback>
        </Avatar>
    )
}