"use client"

import * as React from "react"
import Image from "next/image"
import { useQuery } from "convex/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

interface UserAvatarProps {
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

const sizePixels = {
    sm: 24,
    md: 40, // Using larger size for md
    lg: 64
}

export function UserAvatar({
    avatarStorageId,
    fallbackUrl,
    firstName,
    lastName,
    className = "",
    size = "md"
}: UserAvatarProps) {
    // Only fetch avatar URL from Convex if we have a storage ID
    const avatarUrl = useQuery(
        api.users.getAvatarUrl,
        avatarStorageId ? { storageId: avatarStorageId } : "skip"
    )

    // Keep track of the last valid image and storage ID to prevent glitches during loading
    const [lastValidImage, setLastValidImage] = React.useState<string | undefined>(undefined)
    const [lastStorageId, setLastStorageId] = React.useState<Id<"_storage"> | undefined>(undefined)

    // Clear cache when avatarStorageId is removed (changes from value to undefined)
    React.useEffect(() => {
        if (lastStorageId && !avatarStorageId) {
            // Avatar was removed - clear the cache
            setLastValidImage(undefined)
            setLastStorageId(undefined)
        } else if (avatarStorageId && avatarStorageId !== lastStorageId) {
            // Avatar storage ID changed - update tracking
            setLastStorageId(avatarStorageId)
        }
    }, [avatarStorageId, lastStorageId])

    // Determine the image source to use
    const imageSrc = React.useMemo(() => {
        let currentImage: string | undefined = undefined

        // Priority 1: If we have a storage ID, use its URL
        if (avatarStorageId && avatarUrl) {
            currentImage = avatarUrl
        }
        // Priority 2: If storage ID is explicitly undefined (not just loading),
        // and we have a fallback URL from Clerk, use it
        else if (!avatarStorageId && fallbackUrl) {
            currentImage = fallbackUrl
        }
        
        // Update last valid image if we have a new one
        if (currentImage) {
            setLastValidImage(currentImage)
            return currentImage
        }
        
        // If loading (avatarStorageId exists but avatarUrl is undefined),
        // keep showing the last valid image to prevent glitch
        if (avatarStorageId && !avatarUrl && lastValidImage) {
            return lastValidImage
        }
        
        // No valid image source - show PNG fallback
        return undefined
    }, [avatarStorageId, avatarUrl, fallbackUrl, lastValidImage])

    return (
        <Avatar className={`${sizeClasses[size]} flex-shrink-0 ${className}`}>
            <AvatarImage
                src={imageSrc}
                alt={`${firstName} ${lastName}`}
                loading="lazy"
            />
            <AvatarFallback className="bg-muted">
                <Image 
                    src="/default-avatar.png" 
                    alt="Default avatar" 
                    width={sizePixels[size]} 
                    height={sizePixels[size]}
                    className="object-cover"
                />
            </AvatarFallback>
        </Avatar>
    )
}