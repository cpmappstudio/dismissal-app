"use client"

import ProgramInfoCard from './student/program-info-card'
import MetricsGrid from './student/metrics-grid'
import CurrentSubjectsCard from './student/current-subjects-card'
import SidebarWidgets from './student/sidebar-widgets'

export default function StudentDashboard() {
    // TODO: Usar la query real de Convex
    // const dashboardData = useQuery(api.studentDashboard.getStudentDashboard)

    // Mock data mientras implementamos la conexión real
    // Este data debería venir de getStudentDashboard query
    const mockDashboardData = {
        student: {
            name: "Juan Pérez",
            email: "juan.perez@alef.edu",
            studentProfile: {
                studentCode: "2021-001",
                status: "active" as const
            }
        },
        program: {
            code: "IDS-001",
            name: "Ingeniería de Software",
            totalCredits: 120
        },
        currentPeriod: {
            code: "2025-1",
            name: "Período 2025-1"
        },
        currentEnrollments: [
            {
                enrollment: { finalGrade: 4.2, status: "enrolled" as const },
                course: { code: "CS401", name: "Algoritmos Avanzados", credits: 3 },
                section: { groupNumber: "01" },
                professor: { name: "Dr. García" }
            },
            {
                enrollment: { finalGrade: 3.8, status: "enrolled" as const },
                course: { code: "CS402", name: "Base de Datos", credits: 4 },
                section: { groupNumber: "01" },
                professor: { name: "Dra. López" }
            }
        ],
        currentCredits: 15,
        currentPeriodGPA: 3.9,
        cumulativeGPA: 3.85,
        progress: {
            humanitiesCredits: 28,
            coreCredits: 48,
            electiveCredits: 13,
            totalCredits: 89,
            requiredHumanities: 40,
            requiredCore: 60,
            requiredElective: 20,
            requiredTotal: 120,
            humanitiesProgress: 70,
            coreProgress: 80,
            electiveProgress: 65,
            overallProgress: 74
        }
    }

    // Transformar los datos de Convex al formato esperado por los componentes
    const metricsData = {
        completedCredits: mockDashboardData.progress.totalCredits,
        totalCredits: mockDashboardData.progress.requiredTotal,
        completionPercentage: mockDashboardData.progress.overallProgress,
        creditsRemaining: mockDashboardData.progress.requiredTotal - mockDashboardData.progress.totalCredits,
        gpa: mockDashboardData.cumulativeGPA,
        currentPeriod: mockDashboardData.currentPeriod?.code || "N/A",
        enrolledSubjects: mockDashboardData.currentEnrollments.length,
        creditsInProgress: mockDashboardData.currentCredits,
        currentBimester: 7, // TODO: calcular basado en fecha de ingreso
        progressPercentage: mockDashboardData.progress.overallProgress,
        bimestersRemaining: 1 // TODO: calcular basado en progreso
    }

    const programData = {
        title: mockDashboardData.program?.name || "Programa",
        subtitle: `Programa de Pregrado • Código: ${mockDashboardData.program?.code}`,
        code: mockDashboardData.program?.code || "N/A",
        admissionDate: "Agosto 2021", // TODO: calcular desde enrollmentDate
        estimatedGraduation: "Diciembre 2025", // TODO: calcular
        totalCredits: mockDashboardData.program?.totalCredits || 120,
        duration: "8 bimestres", // TODO: obtener de configuración del programa
        languages: ["Español", "Inglés"], // TODO: obtener de configuración
        status: "active" as const,
        modality: "presential" as const
    }

    const subjectsData = mockDashboardData.currentEnrollments.map(enrollment => ({
        code: enrollment.course?.code || "N/A",
        name: enrollment.course?.name || "N/A",
        credits: enrollment.course?.credits || 0,
        grade: enrollment.enrollment.finalGrade ? `${enrollment.enrollment.finalGrade.toFixed(1)}` : undefined,
        percentage: enrollment.enrollment.finalGrade ? Math.round(enrollment.enrollment.finalGrade * 20) : undefined, // Convertir 0-5 a 0-100
        status: enrollment.enrollment.status === "enrolled" ? "in-progress" as const : "pending" as const
    }))

    const creditDistributionData = {
        core: {
            completed: mockDashboardData.progress.coreCredits,
            total: mockDashboardData.progress.requiredCore
        },
        humanities: {
            completed: mockDashboardData.progress.humanitiesCredits,
            total: mockDashboardData.progress.requiredHumanities
        },
        electives: {
            completed: mockDashboardData.progress.electiveCredits,
            total: mockDashboardData.progress.requiredElective
        }
    }

    const upcomingDatesData = [
        {
            id: "1",
            title: "Fecha límite calificaciones", // TODO: usar traducciones
            date: "15 Dic 2024",
            type: "deadline" as const
        },
        {
            id: "2",
            title: "Inicio próximo bimestre", // TODO: usar traducciones
            date: "20 Ene 2025",
            type: "start" as const
        },
        {
            id: "3",
            title: "Matrícula anticipada", // TODO: usar traducciones
            date: "10 Ene 2025",
            type: "enrollment" as const
        }
    ]

    return (
        <div className="@container/main space-y-6 px-1 lg:px-6">
            {/* Program Information */}
            <ProgramInfoCard programData={programData} />

            {/* Metrics Grid */}
            <MetricsGrid metricsData={metricsData} />

            {/* Widgets Row - Credit Distribution (2 cols) + Upcoming Dates (1 col) + Documents (1 col) */}
            <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs items-stretch lg:grid-cols-4">
                {/* Credit Distribution - spans 2 columns */}
                <div className="lg:col-span-2 h-full">
                    <SidebarWidgets
                        creditDistribution={creditDistributionData}
                        upcomingDates={[]} // Solo mostrar credit distribution aquí
                        showOnlyCredits={true}
                    />
                </div>

                {/* Upcoming Dates - 1 column */}
                <div className="lg:col-span-1 h-full">
                    <SidebarWidgets
                        creditDistribution={creditDistributionData}
                        upcomingDates={upcomingDatesData}
                        showOnlyDates={true}
                    />
                </div>

                {/* Documents - 1 column */}
                <div className="lg:col-span-1 h-full">
                    <SidebarWidgets
                        creditDistribution={creditDistributionData}
                        upcomingDates={upcomingDatesData}
                        showOnlyDocuments={true}
                    />
                </div>
            </div>

            {/* Current Subjects Table - Full width at bottom */}
            <CurrentSubjectsCard
                currentPeriod={metricsData.currentPeriod}
                enrolledSubjects={metricsData.enrolledSubjects}
                creditsInProgress={metricsData.creditsInProgress}
                subjects={subjectsData}
            />
        </div>
    )
}
