import { Calendar } from "lucide-react"
import { useTranslations } from "next-intl"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

interface UpcomingDate {
    id: string
    title: string
    date: string
    type: 'deadline' | 'start' | 'enrollment'
}

interface UpcomingDatesCardProps {
    upcomingDates: UpcomingDate[]
}

export default function UpcomingDatesCard({ upcomingDates }: UpcomingDatesCardProps) {
    const t = useTranslations('dashboard.student')

    const getDateColor = (type: UpcomingDate['type']) => {
        switch (type) {
            case 'deadline': return 'bg-orange-500'
            case 'start': return 'bg-blue-500'
            case 'enrollment': return 'bg-green-500'
            default: return 'bg-gray-500'
        }
    }

    return (
        <Card className="@container/card h-full" data-slot="card">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    {t('upcomingDates.title')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 text-sm">
                    {upcomingDates.map((date) => (
                        <div key={date.id} className="flex items-center gap-3">
                            <div className={`w-2 h-2 ${getDateColor(date.type)} rounded-full`} />
                            <div>
                                <div className="font-medium">{date.title}</div>
                                <div className="text-muted-foreground">{date.date}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
