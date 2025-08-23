import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ProgramInfoCardProps {
    programData: {
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
}

export default function ProgramInfoCard({ programData }: ProgramInfoCardProps) {
    const t = useTranslations('dashboard.student')

    if (!programData) {
        return null
    }

    return (
        <Card className="bg-[radial-gradient(circle_at_top_right,_var(--color-fuzzy-wuzzy)_0%,_var(--color-deep-koamaru)_50%)] text-white border-0 shadow-lg">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="flex items-center gap-3 text-xl">
                            <GraduationCap className="size-6" />
                            {programData.title}
                        </CardTitle>
                        <CardDescription className="mt-1 text-white/80">
                            {programData.subtitle}
                        </CardDescription>
                    </div>
                    <Link href={`/programs/${programData.code.toLowerCase()}`}>
                        <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                            {t('program.viewDetails')}
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <div className="text-sm font-medium text-white/70">{t('program.admissionDate')}</div>
                        <div className="text-base font-semibold">{programData.admissionDate}</div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-white/70">{t('program.estimatedGraduation')}</div>
                        <div className="text-base font-semibold">{programData.estimatedGraduation}</div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-white/70">{t('program.totalCredits')}</div>
                        <div className="text-base font-semibold">{programData.totalCredits} créditos</div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-white/70">{t('program.duration')}</div>
                        <div className="text-base font-semibold">{programData.duration}</div>
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-white/20">
                    <div>
                        <div className="text-sm font-medium text-white/70">{t('program.languages')}</div>
                        <div className="text-base font-semibold">{programData.languages.join(' • ')}</div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-white/70">{t('program.status')}</div>
                        <Badge className="bg-green-500/20 text-green-100 border-green-400/30 hover:bg-green-500/30">
                            {programData.status === 'active' ? t('program.active') : 'Inactivo'} • {t('program.modalityPresential')}
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
