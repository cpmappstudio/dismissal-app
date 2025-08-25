import Link from "next/link"
import { FileText, Download, BarChart3, Calendar } from "lucide-react"
import { useTranslations } from "next-intl"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function QuickActionsCard() {
    const t = useTranslations('dashboard.student')

    return (
        <Card className="@container/card h-full" data-slot="card">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4" />
                    {t('documents.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <Link href="/academic/transcripts">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                        <Download className="size-4 mr-2" />
                        {t('documents.transcriptCertificate')}
                    </Button>
                </Link>
                <Link href="/academic/history">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                        <FileText className="size-4 mr-2" />
                        {t('documents.academicHistory')}
                    </Button>
                </Link>
                <Link href="/academic/progress">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                        <BarChart3 className="size-4 mr-2" />
                        {t('documents.progressAnalysis')}
                    </Button>
                </Link>
                <Link href="/academic/calendar">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                        <Calendar className="size-4 mr-2" />
                        {t('documents.academicCalendar')}
                    </Button>
                </Link>
            </CardContent>
        </Card>
    )
}
