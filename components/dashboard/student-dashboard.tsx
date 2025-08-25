"use client"

import ProgramInfoCard from './academic/program-info-card'
import MetricsGrid from './academic/metrics-grid'
import CurrentSubjectsCard from './academic/current-subjects-card'

export default function StudentDashboard() {
    // TODO: Replace with real Convex queries
    // Each component now handles its own data fetching independently
    // This prevents blocking the entire dashboard if one query is slow

    return (
        <div className="@container/main space-y-4 md:space-y-6 lg:px-6">
            <ProgramInfoCard />
            <MetricsGrid />
            <CurrentSubjectsCard />
        </div>
    )
}
