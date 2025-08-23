import Link from "next/link"
import { BookOpen } from "lucide-react"
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

interface Subject {
    code: string
    name: string
    credits: number
    grade?: string
    percentage?: number
    status: 'in-progress' | 'pending' | 'completed'
}

interface CurrentSubjectsProps {
    currentPeriod: string
    enrolledSubjects: number
    creditsInProgress: number
    subjects: Subject[]
}

export default function CurrentSubjectsCard({ 
    currentPeriod, 
    enrolledSubjects, 
    creditsInProgress, 
    subjects 
}: CurrentSubjectsProps) {
    const t = useTranslations('dashboard.student')

    const formatGrade = (subject: Subject) => {
        if (subject.grade && subject.percentage) {
            return `${subject.grade} (${subject.percentage}%)`
        }
        return t('currentSubjects.pending')
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="size-5" />
                        {t('currentSubjects.title')}
                    </CardTitle>
                    <CardDescription>
                        {t('currentSubjects.subtitle', {
                            period: currentPeriod,
                            count: enrolledSubjects,
                            credits: creditsInProgress
                        })}
                    </CardDescription>
                </div>
                <Link href="/academic/history">
                    <Button variant="outline" size="sm">
                        {t('currentSubjects.viewHistory')}
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <div>{t('currentSubjects.code')}</div>
                        <div>{t('currentSubjects.subject')}</div>
                        <div>{t('currentSubjects.credits')}</div>
                        <div>{t('currentSubjects.grade')}</div>
                        <div>{t('currentSubjects.status')}</div>
                    </div>
                    <div className="space-y-3">
                        {subjects.map((subject, index) => (
                            <Link 
                                key={subject.code} 
                                href={`/courses/${subject.code.toLowerCase()}`} 
                                className="grid grid-cols-5 gap-4 text-sm hover:bg-muted/50 p-2 rounded-md transition-colors cursor-pointer"
                            >
                                <div className="font-mono">{subject.code}</div>
                                <div>{subject.name}</div>
                                <div>{subject.credits}</div>
                                <div className={subject.grade ? "font-medium" : "text-muted-foreground"}>
                                    {formatGrade(subject)}
                                </div>
                                <Badge variant="outline" className="w-fit">
                                    {subject.status === 'in-progress' ? t('currentSubjects.inProgress') : t('currentSubjects.pending')}
                                </Badge>
                            </Link>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
