"use client"

import ProgramInfoCard from './student/program-info-card'
import MetricsGrid from './student/metrics-grid'
import CurrentSubjectsCard from './student/current-subjects-card'
// import DashboardWidgets from './student/dashboard-widgets'
import {
    getMockStudentData,
    transformToMetricsData,
    transformToProgramData,
    transformToSubjectsData,
    // transformToCreditDistribution,
    // getMockUpcomingDates
} from './student/dashboard-data'

export default function StudentDashboard() {
    // TODO: Replace with real Convex query
    // const dashboardData = useQuery(api.studentDashboard.getStudentDashboard)

    const mockData = getMockStudentData()

    const metricsData = transformToMetricsData(mockData)
    const programData = transformToProgramData(mockData)
    const subjectsData = transformToSubjectsData(mockData)
    // const creditDistribution = transformToCreditDistribution(mockData)
    // const upcomingDates = getMockUpcomingDates()

    return (
        <div className="@container/main space-y-4 md:space-y-6 lg:px-6">
            <ProgramInfoCard programData={programData} />
            <MetricsGrid metricsData={metricsData} />
            {/* <DashboardWidgets
                creditDistribution={creditDistribution}
                upcomingDates={upcomingDates}
            /> */}
            <CurrentSubjectsCard
                currentPeriod={metricsData.currentPeriod}
                enrolledSubjects={metricsData.enrolledSubjects}
                creditsInProgress={metricsData.creditsInProgress}
                subjects={subjectsData}
            />
        </div>
    )
}
