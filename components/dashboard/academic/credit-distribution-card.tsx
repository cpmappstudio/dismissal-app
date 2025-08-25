import Link from "next/link"
import { BarChart3 } from "lucide-react"
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

interface CreditDistributionCardProps {
    creditDistribution: CreditDistribution
}

export default function CreditDistributionCard({ creditDistribution }: CreditDistributionCardProps) {
    const t = useTranslations('dashboard.student')

    const calculatePercentage = (completed: number, total: number) => {
        return Math.round((completed / total) * 100)
    }

    return (
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
    )
}
