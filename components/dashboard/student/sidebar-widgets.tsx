import Link from "next/link"
import { BarChart3, Calendar, FileText, Download } from "lucide-react"
import { useTranslations } from "next-intl"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CreditDistribution {
    core: { completed: number; total: number }
    humanities: { completed: number; total: number }
    electives: { completed: number; total: number }
}

interface UpcomingDate {
    id: string
    title: string
    date: string
    type: 'deadline' | 'start' | 'enrollment'
}

interface SidebarWidgetsProps {
    creditDistribution: CreditDistribution
    upcomingDates: UpcomingDate[]
    showOnlyCredits?: boolean
    showOnlyDates?: boolean
    showOnlyDocuments?: boolean
}

export default function SidebarWidgets({
    creditDistribution,
    upcomingDates,
    showOnlyCredits = false,
    showOnlyDates = false,
    showOnlyDocuments = false
}: SidebarWidgetsProps) {
    const t = useTranslations('dashboard.student')

    const getDateColor = (type: UpcomingDate['type']) => {
        switch (type) {
            case 'deadline': return 'bg-orange-500'
            case 'start': return 'bg-blue-500'
            case 'enrollment': return 'bg-green-500'
            default: return 'bg-gray-500'
        }
    }

    const calculatePercentage = (completed: number, total: number) => {
        return Math.round((completed / total) * 100)
    }

    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs h-full">
            {/* Credit Distribution Card */}
            {(!showOnlyDates && !showOnlyDocuments) && (
                <Card className="@container/card h-full" data-slot="card">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="size-4" />
                            {t('creditDistribution.title')}
                        </CardTitle>
                        <Link href="/academic/progress">
                            <Button variant="ghost" size="sm">
                                <BarChart3 className="size-4" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('creditDistribution.core')}</span>
                                    <span className="font-medium">
                                        {creditDistribution.core.completed}/{creditDistribution.core.total}
                                    </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${calculatePercentage(creditDistribution.core.completed, creditDistribution.core.total)}%` }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('creditDistribution.humanities')}</span>
                                    <span className="font-medium">
                                        {creditDistribution.humanities.completed}/{creditDistribution.humanities.total}
                                    </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${calculatePercentage(creditDistribution.humanities.completed, creditDistribution.humanities.total)}%` }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('creditDistribution.electives')}</span>
                                    <span className="font-medium">
                                        {creditDistribution.electives.completed}/{creditDistribution.electives.total}
                                    </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 rounded-full"
                                        style={{ width: `${calculatePercentage(creditDistribution.electives.completed, creditDistribution.electives.total)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Upcoming Dates Card */}
            {(!showOnlyCredits && !showOnlyDocuments) && (
                <Card className="@container/card h-full" data-slot="card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="size-4" />
                            {t('upcomingDates.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
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
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Actions / Documents Card */}
            {(!showOnlyCredits && !showOnlyDates) && (
                <Card className="@container/card h-full" data-slot="card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="size-4" />
                            {t('documents.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Link href="/academic/transcripts">
                            <Button variant="ghost" className="w-full justify-start" size="sm">
                                <Download className="size-4 mr-2" />
                                {t('documents.transcriptCertificate')}
                            </Button>
                        </Link>
                        <Link href="/academic/history">
                            <Button variant="ghost" className="w-full justify-start" size="sm">
                                <FileText className="size-4 mr-2" />
                                {t('documents.academicHistory')}
                            </Button>
                        </Link>
                        <Link href="/academic/progress">
                            <Button variant="ghost" className="w-full justify-start" size="sm">
                                <BarChart3 className="size-4 mr-2" />
                                {t('documents.progressAnalysis')}
                            </Button>
                        </Link>
                        <Link href="/academic/calendar">
                            <Button variant="ghost" className="w-full justify-start" size="sm">
                                <Calendar className="size-4 mr-2" />
                                {t('documents.academicCalendar')}
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
