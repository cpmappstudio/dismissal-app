/**
 * Mock data and data transformation utilities for the student dashboard
 * TODO: Replace with real Convex queries
 */

export const getMockStudentData = () => {
    return {
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
}

export const transformToMetricsData = (data: ReturnType<typeof getMockStudentData>) => ({
    completedCredits: data.progress.totalCredits,
    totalCredits: data.progress.requiredTotal,
    completionPercentage: data.progress.overallProgress,
    creditsRemaining: data.progress.requiredTotal - data.progress.totalCredits,
    gpa: data.cumulativeGPA,
    currentPeriod: data.currentPeriod?.code || "N/A",
    enrolledSubjects: data.currentEnrollments.length,
    creditsInProgress: data.currentCredits,
    currentBimester: 7,
    progressPercentage: data.progress.overallProgress,
    bimestersRemaining: 1
})

export const transformToProgramData = (data: ReturnType<typeof getMockStudentData>) => ({
    title: data.program?.name || "Programa",
    subtitle: `Programa de Pregrado • Código: ${data.program?.code}`,
    code: data.program?.code || "N/A",
    admissionDate: "Agosto 2021",
    estimatedGraduation: "Diciembre 2025",
    totalCredits: data.program?.totalCredits || 120,
    duration: "8 bimestres",
    languages: ["Español", "Inglés"],
    status: "active" as const,
    modality: "presential" as const
})

export const transformToSubjectsData = (data: ReturnType<typeof getMockStudentData>) =>
    data.currentEnrollments.map(enrollment => ({
        code: enrollment.course?.code || "N/A",
        name: enrollment.course?.name || "N/A",
        credits: enrollment.course?.credits || 0,
        grade: enrollment.enrollment.finalGrade ? `${enrollment.enrollment.finalGrade.toFixed(1)}` : undefined,
        percentage: enrollment.enrollment.finalGrade ? Math.round(enrollment.enrollment.finalGrade * 20) : undefined,
        status: enrollment.enrollment.status === "enrolled" ? "in-progress" as const : "pending" as const
    }))

export const transformToCreditDistribution = (data: ReturnType<typeof getMockStudentData>) => ({
    core: {
        completed: data.progress.coreCredits,
        total: data.progress.requiredCore
    },
    humanities: {
        completed: data.progress.humanitiesCredits,
        total: data.progress.requiredHumanities
    },
    electives: {
        completed: data.progress.electiveCredits,
        total: data.progress.requiredElective
    }
})

export const getMockUpcomingDates = () => [
    {
        id: "1",
        title: "Fecha límite calificaciones",
        date: "15 Dic 2024",
        type: "deadline" as const
    },
    {
        id: "2",
        title: "Inicio próximo bimestre",
        date: "20 Ene 2025",
        type: "start" as const
    },
    {
        id: "3",
        title: "Matrícula anticipada",
        date: "10 Ene 2025",
        type: "enrollment" as const
    }
]
