import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Users,
    Car,
    MapPin,
    Clock,
    ArrowRight,
    Truck,
    Navigation,
    AlertTriangle,
    CheckCircle,
    TrendingUp,
    Activity
} from "lucide-react"
import Link from "next/link"

export default function OperatorsPage() {
    const t = useTranslations('operators')

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* <OperatorsTable /> */}
        </div>
    )
}
