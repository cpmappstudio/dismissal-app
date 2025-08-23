import CreditDistributionCard from './credit-distribution-card'
import UpcomingDatesCard from './upcoming-dates-card'
import QuickActionsCard from './quick-actions-card'

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

interface DashboardWidgetsProps {
    creditDistribution: CreditDistribution
    upcomingDates: UpcomingDate[]
}

export default function DashboardWidgets({
    creditDistribution,
    upcomingDates
}: DashboardWidgetsProps) {
    return (
        <div className="grid grid-cols-1 gap-4 items-stretch xl:grid-cols-4">
            {/* Credit Distribution - spans 2 columns */}
            <div className="xl:col-span-2 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                <CreditDistributionCard creditDistribution={creditDistribution} />
            </div>

            {/* Upcoming Dates - 1 column */}
            <div className="xl:col-span-1 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                <UpcomingDatesCard upcomingDates={upcomingDates} />
            </div>

            {/* Quick Actions - 1 column */}
            <div className="xl:col-span-1 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                <QuickActionsCard />
            </div>
        </div>
    )
}
