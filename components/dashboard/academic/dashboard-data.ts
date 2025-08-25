/**
 * Mock data and data transformation utilities for the student dashboard
 * 
 * This file provides individual mock functions for each component to prevent
 * performance issues where a slow query would block the entire dashboard.
 * Each component now fetches its own data independently.
 * 
 * TODO: Replace with real Convex queries
 */

import type { Doc } from '@/convex/_generated/dataModel'

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

// Individual component mock functions for independent data fetching
export const getMockProgramData = (): { program: Doc<"programs">; user: Doc<"users"> } => {
    // This now returns data matching the real Convex schema structure
    return {
        program: {
            _id: "program1" as any, // Mock ID
            _creationTime: Date.now(),
            nameEs: "Ingeniería de Software",
            nameEn: "Software Engineering",
            code: "IDS-001",
            type: "bachelor" as const,
            language: "both" as const,
            totalCredits: 120,
            durationBimesters: 8,
            isActive: true,
            descriptionEs: "Programa de pregrado enfocado en desarrollo de software",
            degree: "Ingeniero de Software",
            createdAt: Date.now()
        },
        user: {
            _id: "user1" as any, // Mock ID
            _creationTime: Date.now(),
            clerkId: "clerk_123",
            email: "student@alef.edu",
            firstName: "Juan",
            lastName: "Pérez",
            role: "student" as const,
            isActive: true,
            createdAt: Date.now(),
            studentProfile: {
                studentCode: "2021-001",
                programId: "program1" as any,
                enrollmentDate: new Date("2021-08-01").getTime(),
                expectedGraduationDate: new Date("2025-12-15").getTime(),
                status: "active" as const
            }
        }
    }
}

export const getMockMetricsData = () => {
    const baseData = getMockStudentData()
    return transformToMetricsData(baseData)
}

export const getMockCurrentSubjectsData = () => {
    const baseData = getMockStudentData()
    const metricsData = transformToMetricsData(baseData)
    const subjectsData = transformToSubjectsData(baseData)

    return {
        currentPeriod: metricsData.currentPeriod,
        enrolledSubjects: metricsData.enrolledSubjects,
        creditsInProgress: metricsData.creditsInProgress,
        subjects: subjectsData
    }
}
