/**
 * Program Information Card Component
 * 
 * Displays comprehensive program information including:
 * - Program name, code, and type
 * - Degree awarded
 * - Credits and duration
 * - Languages and admission date
 */

import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { getMockProgramData } from './dashboard-data'
import {
    getProgramName,
    getProgramTypeLabel,
    getProgramLanguages,
    formatEnrollmentDate
} from '@/lib/program-utils'
import type { Doc } from '@/convex/_generated/dataModel'

interface ProgramInfoCardProps {
    data?: {
        program: Doc<"programs">
        user: Doc<"users">
    }
}

export default function ProgramInfoCard({ data }: ProgramInfoCardProps = {}) {
    const t = useTranslations('dashboard.student')
    const locale = useLocale()

    // TODO: Replace with real Convex query
    // const dashboardData = useQuery(api.dashboard.getStudentDashboard)
    const mockData = data || getMockProgramData()

    const { program, user } = mockData
    const { studentProfile } = user

    // Early return if required data is missing
    if (!program || !studentProfile) {
        return null
    }

    const programName = getProgramName(program.nameEs, program.nameEn, locale)
    const programTypeLabel = getProgramTypeLabel(program.type)
    const languageLabels = getProgramLanguages(program.language)
    const formattedEnrollmentDate = formatEnrollmentDate(studentProfile.enrollmentDate)

    return (
        <Card className="bg-[radial-gradient(circle_at_top_right,_var(--color-fuzzy-wuzzy)_0%,_var(--color-deep-koamaru)_50%)] text-white border-0 shadow-lg">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Program Information */}
                    <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-3 text-xl mb-2">
                            <GraduationCap className="size-6 flex-shrink-0" />
                            <span className="truncate">{programName}</span>
                        </CardTitle>
                        <CardDescription className="text-white/80">
                            {programTypeLabel} • Código: {program.code}
                            {program.degree && (
                                <>
                                    <br />
                                    <span className="text-sm">Título: {program.degree}</span>
                                </>
                            )}
                        </CardDescription>
                    </div>

                    {/* Action Button */}
                    <div className="flex flex-col gap-2 sm:items-end">
                        <Link href={`/programs/${program.code.toLowerCase()}`}>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="bg-white/20 hover:bg-white/30 text-white border-white/30 w-full sm:w-auto"
                            >
                                {t('program.viewDetails')}
                            </Button>
                        </Link>
                    </div>
                </div>
            </CardHeader>

            {/* Program Details Grid */}
            <CardContent className="pt-0">
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <ProgramDetailItem
                        label={t('program.admissionDate')}
                        value={formattedEnrollmentDate}
                    />
                    <ProgramDetailItem
                        label={t('program.languages')}
                        value={languageLabels.join(' • ')}
                    />
                    <ProgramDetailItem
                        label={t('program.totalCredits')}
                        value={`${program.totalCredits} créditos`}
                    />
                    <ProgramDetailItem
                        label={t('program.duration')}
                        value={`${program.durationBimesters} bimestres`}
                    />
                </div>
            </CardContent>
        </Card>
    )
}

/**
 * Individual detail item component for the grid
 */
interface ProgramDetailItemProps {
    label: string
    value: string
}

function ProgramDetailItem({ label, value }: ProgramDetailItemProps) {
    return (
        <div>
            <div className="text-sm font-medium text-white/70">{label}</div>
            <div className="text-base font-semibold">{value}</div>
        </div>
    )
}