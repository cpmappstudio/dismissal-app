"use client"

import ProgramInfoCard from './student/program-info-card'
import MetricsGrid from './student/metrics-grid'
import CurrentSubjectsCard from './student/current-subjects-card'
import SidebarWidgets from './student/sidebar-widgets'
import type { 
    StudentMetrics, 
    ProgramInfo, 
    Subject, 
    CreditDistribution, 
    UpcomingDate 
} from './student/types'

export default function StudentDashboard() {
    // TODO: Estos valores vendrán de la base de datos
    const metricsData: StudentMetrics = {
        completedCredits: 89,
        totalCredits: 120,
        completionPercentage: 74,
        creditsRemaining: 31,
        gpa: 3.85,
        currentPeriod: "2025-1",
        enrolledSubjects: 5,
        creditsInProgress: 15,
        currentBimester: 7,
        totalBimestres: 8,
        progressPercentage: 87,
        bimestersRemaining: 1
    }

    const programData: ProgramInfo = {
        title: "Ingeniería de Software",
        subtitle: "Programa de Pregrado • Código: IDS-001",
        code: "IDS-001",
        admissionDate: "Agosto 2021",
        estimatedGraduation: "Diciembre 2025",
        totalCredits: 120,
        duration: "8 bimestres",
        languages: ["Español", "Inglés"],
        status: "active",
        modality: "presential"
    }

    const subjectsData: Subject[] = [
        {
            code: "CS401",
            name: "Algoritmos Avanzados",
            credits: 3,
            grade: "A",
            percentage: 92,
            status: "in-progress"
        },
        {
            code: "CS402",
            name: "Base de Datos",
            credits: 4,
            grade: "B+",
            percentage: 88,
            status: "in-progress"
        },
        {
            code: "HU301",
            name: "Ética Profesional",
            credits: 2,
            grade: "A-",
            percentage: 90,
            status: "in-progress"
        },
        {
            code: "CS403",
            name: "Arquitectura de Software",
            credits: 3,
            status: "pending"
        },
        {
            code: "CS404",
            name: "Proyecto Final",
            credits: 3,
            status: "pending"
        }
    ]

    const creditDistributionData: CreditDistribution = {
        core: { completed: 48, total: 60 },
        humanities: { completed: 28, total: 40 },
        electives: { completed: 13, total: 20 }
    }

    const upcomingDatesData: UpcomingDate[] = [
        {
            id: "1",
            title: "Fecha límite calificaciones", // TODO: usar traducciones
            date: "15 Dic 2024",
            type: "deadline"
        },
        {
            id: "2",
            title: "Inicio próximo bimestre", // TODO: usar traducciones
            date: "20 Ene 2025",
            type: "start"
        },
        {
            id: "3",
            title: "Matrícula anticipada", // TODO: usar traducciones
            date: "10 Ene 2025",
            type: "enrollment"
        }
    ]

    return (
        <div className="@container/main space-y-6">
            {/* Program Information */}
            <div className="px-4 lg:px-6">
                <ProgramInfoCard programData={programData} />
            </div>

            {/* Metrics Grid */}
            <MetricsGrid metricsData={metricsData} />

            {/* Main Content */}
            <div className="grid gap-6 px-4 lg:px-6 lg:grid-cols-3">
                {/* Current Subjects */}
                <div className="lg:col-span-2">
                    <CurrentSubjectsCard
                        currentPeriod={metricsData.currentPeriod}
                        enrolledSubjects={metricsData.enrolledSubjects}
                        creditsInProgress={metricsData.creditsInProgress}
                        subjects={subjectsData}
                    />
                </div>

                {/* Sidebar Widgets */}
                <SidebarWidgets
                    creditDistribution={creditDistributionData}
                    upcomingDates={upcomingDatesData}
                />
            </div>
        </div>
    )
}
