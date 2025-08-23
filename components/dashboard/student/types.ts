export interface StudentMetrics {
    completedCredits: number
    totalCredits: number
    completionPercentage: number
    creditsRemaining: number
    gpa: number
    currentPeriod: string
    enrolledSubjects: number
    creditsInProgress: number
    currentBimester: number
    totalBimestres: number
    progressPercentage: number
    bimestersRemaining: number
}

export interface ProgramInfo {
    title: string
    subtitle: string
    code: string
    admissionDate: string
    estimatedGraduation: string
    totalCredits: number
    duration: string
    languages: string[]
    status: 'active' | 'inactive'
    modality: 'presential' | 'virtual' | 'hybrid'
}

export interface Subject {
    code: string
    name: string
    credits: number
    grade?: string
    percentage?: number
    status: 'in-progress' | 'pending' | 'completed'
}

export interface CreditDistribution {
    core: { completed: number; total: number }
    humanities: { completed: number; total: number }
    electives: { completed: number; total: number }
}

export interface UpcomingDate {
    id: string
    title: string
    date: string
    type: 'deadline' | 'start' | 'enrollment'
}

export interface StudentDashboardData {
    metrics: StudentMetrics
    program: ProgramInfo
    subjects: Subject[]
    creditDistribution: CreditDistribution
    upcomingDates: UpcomingDate[]
}
