import { TrendingUp, Award, BookOpen, Target, LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardAction,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { getMockMetricsData } from './dashboard-data'

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

interface MetricCardProps {
    title: string
    value: string
    badge: {
        icon: LucideIcon
        text: string
        variant?: "default" | "secondary" | "destructive" | "outline"
        className?: string
    }
    footer: {
        title: string
        description: string
        icon: LucideIcon
    }
}

function MetricCard({ title, value, badge, footer }: MetricCardProps) {
    const BadgeIcon = badge.icon
    const FooterIcon = footer.icon

    return (
        <Card className="@container/card" data-slot="card">
            <CardHeader>
                <div className="text-sm text-muted-foreground">{title}</div>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {value}
                </CardTitle>
                <CardAction>
                    <Badge variant={badge.variant || "outline"} className={badge.className}>
                        <BadgeIcon className="size-3" />
                        {badge.text}
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                    {footer.title} <FooterIcon className="size-4" />
                </div>
                <div className="text-muted-foreground">
                    {footer.description}
                </div>
            </CardFooter>
        </Card>
    )
}

interface MetricsGridProps {
    // Props are now optional since we fetch data internally
    metricsData?: MetricsData
}

export default function MetricsGrid({ metricsData }: MetricsGridProps) {
    const t = useTranslations('dashboard.student')

    // TODO: Replace with real Convex query
    // const metricsData = useQuery(api.studentDashboard.getMetrics)
    const data = metricsData || getMockMetricsData()

    const metricsConfig = [
        {
            title: t('metrics.completedCredits'),
            value: `${data.completedCredits} / ${data.totalCredits}`,
            badge: {
                icon: TrendingUp,
                text: `${data.completionPercentage}%`
            },
            footer: {
                title: t('metrics.excellentProgress'),
                description: t('metrics.creditsRemaining', { count: data.creditsRemaining }),
                icon: TrendingUp
            }
        },
        {
            title: t('metrics.cumulativeGPA'),
            value: data.gpa.toString(),
            badge: {
                icon: Award,
                text: t('metrics.excellent'),
                variant: "outline" as const,
                className: "bg-green-50 text-green-700"
            },
            footer: {
                title: t('metrics.outstandingPerformance'),
                description: t('metrics.maintainLevel'),
                icon: Award
            }
        },
        {
            title: t('metrics.currentBimester'),
            value: data.currentPeriod,
            badge: {
                icon: BookOpen,
                text: `${data.enrolledSubjects} ${t('metrics.subjects')}`
            },
            footer: {
                title: t('metrics.currentlyEnrolled'),
                description: t('metrics.creditsInProgress', { count: data.creditsInProgress }),
                icon: BookOpen
            }
        },
        {
            title: t('metrics.careerProgress'),
            value: `${data.currentBimester}mo`,
            badge: {
                icon: Target,
                text: `${data.progressPercentage}%`
            },
            footer: {
                title: t('metrics.almostGraduating'),
                description: t('metrics.bimestersRemaining', { count: data.bimestersRemaining }),
                icon: Target
            }
        }
    ]

    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {metricsConfig.map((metric, index) => (
                <MetricCard key={index} {...metric} />
            ))}
        </div>
    )
}
