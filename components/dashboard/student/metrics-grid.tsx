import { TrendingUp, Award, BookOpen, Target } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardAction,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

interface MetricsData {
    completedCredits: number
    totalCredits: number
    completionPercentage: number
    creditsRemaining: number
    gpa: number
    currentPeriod: string
    enrolledSubjects: number
    creditsInProgress: number
    currentBimester: number
    progressPercentage: number
    bimestersRemaining: number
}

interface MetricsGridProps {
    metricsData: MetricsData
}

export default function MetricsGrid({ metricsData }: MetricsGridProps) {
    const t = useTranslations('dashboard.student')

    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs  @xl/main:grid-cols-2 @5xl/main:grid-cols-4">

            {/* Completed Credits Card */}
            <Card className="@container/card" data-slot="card">
                <CardHeader>
                    <div className="text-sm text-muted-foreground">{t('metrics.completedCredits')}</div>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {metricsData.completedCredits} / {metricsData.totalCredits}
                    </CardTitle>
                    <CardAction>
                        <Badge variant="outline">
                            <TrendingUp className="size-3" />
                            {metricsData.completionPercentage}%
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        {t('metrics.excellentProgress')} <TrendingUp className="size-4" />
                    </div>
                    <div className="text-muted-foreground">
                        {t('metrics.creditsRemaining', { count: metricsData.creditsRemaining })}
                    </div>
                </CardFooter>
            </Card>

            {/* GPA Card */}
            <Card className="@container/card" data-slot="card">
                <CardHeader>
                    <div className="text-sm text-muted-foreground">{t('metrics.cumulativeGPA')}</div>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {metricsData.gpa}
                    </CardTitle>
                    <CardAction>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                            <Award className="size-3" />
                            {t('metrics.excellent')}
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        {t('metrics.outstandingPerformance')} <Award className="size-4" />
                    </div>
                    <div className="text-muted-foreground">
                        {t('metrics.maintainLevel')}
                    </div>
                </CardFooter>
            </Card>

            {/* Current Bimester Card */}
            <Card className="@container/card" data-slot="card">
                <CardHeader>
                    <div className="text-sm text-muted-foreground">{t('metrics.currentBimester')}</div>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {metricsData.currentPeriod}
                    </CardTitle>
                    <CardAction>
                        <Badge variant="outline">
                            <BookOpen className="size-3" />
                            {metricsData.enrolledSubjects} {t('metrics.subjects')}
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        {t('metrics.currentlyEnrolled')} <BookOpen className="size-4" />
                    </div>
                    <div className="text-muted-foreground">
                        {t('metrics.creditsInProgress', { count: metricsData.creditsInProgress })}
                    </div>
                </CardFooter>
            </Card>

            {/* Career Progress Card */}
            <Card className="@container/card" data-slot="card">
                <CardHeader>
                    <div className="text-sm text-muted-foreground">{t('metrics.careerProgress')}</div>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {metricsData.currentBimester}mo
                    </CardTitle>
                    <CardAction>
                        <Badge variant="outline">
                            <Target className="size-3" />
                            {metricsData.progressPercentage}%
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        {t('metrics.almostGraduating')} <Target className="size-4" />
                    </div>
                    <div className="text-muted-foreground">
                        {t('metrics.bimestersRemaining', { count: metricsData.bimestersRemaining })}
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}
