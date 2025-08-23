import Link from "next/link"
import { BookOpen } from "lucide-react"
import { useTranslations } from "next-intl"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

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

    const getStatusVariant = (status: Subject['status']) => {
        switch (status) {
            case 'in-progress': return 'default'
            case 'pending': return 'secondary'
            case 'completed': return 'outline'
            default: return 'secondary'
        }
    }

    const handleSubjectClick = (subjectCode: string) => {
        window.location.href = `/courses/${subjectCode.toLowerCase()}`
    }

    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
            <Card data-slot="card">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="size-5" />
                            {t('currentSubjects.title')}
                        </CardTitle>
                    </div>
                    <Link href="/academic/history">
                        <Button variant="outline" size="sm">
                            {t('currentSubjects.viewHistory')}
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('currentSubjects.code')}</TableHead>
                                <TableHead>{t('currentSubjects.subject')}</TableHead>
                                <TableHead className="text-center">{t('currentSubjects.credits')}</TableHead>
                                <TableHead className="text-center">{t('currentSubjects.grade')}</TableHead>
                                <TableHead className="text-center">{t('currentSubjects.status')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subjects.map((subject) => (
                                <TableRow
                                    key={subject.code}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSubjectClick(subject.code)}
                                >
                                    <TableCell className="font-mono font-medium">
                                        {subject.code}
                                    </TableCell>
                                    <TableCell>
                                        {subject.name}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {subject.credits}
                                    </TableCell>
                                    <TableCell className={`text-center ${subject.grade ? "font-medium" : "text-muted-foreground"}`}>
                                        {formatGrade(subject)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={getStatusVariant(subject.status)}>
                                            {subject.status === 'in-progress' ? t('currentSubjects.inProgress') : t('currentSubjects.pending')}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter>
                    <CardDescription>
                        {t('currentSubjects.subtitle', {
                            period: currentPeriod,
                            count: enrolledSubjects,
                            credits: creditsInProgress
                        })}
                    </CardDescription>
                </CardFooter>
            </Card>
        </div>
    )
}
