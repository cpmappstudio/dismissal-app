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
    metricsData: MetricsData
}

export default function MetricsGrid({ metricsData }: MetricsGridProps) {
    const t = useTranslations('dashboard.student')

    const metricsConfig = [
        {
            title: t('metrics.completedCredits'),
            value: `${metricsData.completedCredits} / ${metricsData.totalCredits}`,
            badge: {
                icon: TrendingUp,
                text: `${metricsData.completionPercentage}%`
            },
            footer: {
                title: t('metrics.excellentProgress'),
                description: t('metrics.creditsRemaining', { count: metricsData.creditsRemaining }),
                icon: TrendingUp
            }
        },
        {
            title: t('metrics.cumulativeGPA'),
            value: metricsData.gpa.toString(),
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
            value: metricsData.currentPeriod,
            badge: {
                icon: BookOpen,
                text: `${metricsData.enrolledSubjects} ${t('metrics.subjects')}`
            },
            footer: {
                title: t('metrics.currentlyEnrolled'),
                description: t('metrics.creditsInProgress', { count: metricsData.creditsInProgress }),
                icon: BookOpen
            }
        },
        {
            title: t('metrics.careerProgress'),
            value: `${metricsData.currentBimester}mo`,
            badge: {
                icon: Target,
                text: `${metricsData.progressPercentage}%`
            },
            footer: {
                title: t('metrics.almostGraduating'),
                description: t('metrics.bimestersRemaining', { count: metricsData.bimestersRemaining }),
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
