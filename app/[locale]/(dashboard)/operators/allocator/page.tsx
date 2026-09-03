import { getLocale } from "next-intl/server"
import { redirect } from "next/navigation"

export default async function AllocatorPage() {
    redirect(`/${await getLocale()}/operators`)
}
