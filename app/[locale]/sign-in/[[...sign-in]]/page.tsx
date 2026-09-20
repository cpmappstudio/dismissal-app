import { SignIn } from "@clerk/nextjs"
import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { BrandWaves } from "@/components/brand-waves"

export default async function SignInPage() {
    const t = await getTranslations("signInPage")

    return (
        <main className="relative isolate min-h-svh overflow-hidden bg-card">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-44 w-64 rounded-[50%] bg-info sm:-right-32 sm:-top-48 sm:h-80 sm:w-[28rem]" />
            <div className="relative z-10 mx-auto grid min-h-svh w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 pb-32 pt-12 sm:px-10 sm:pb-44 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-12 lg:py-16">
                <section className="min-w-0 text-center lg:self-stretch lg:pt-4 lg:text-left" aria-labelledby="sign-in-heading">
                    <Image
                        src="/oficial-logo.svg"
                        alt="Dismissal"
                        width={1349}
                        height={395}
                        className="mx-auto h-auto w-56 max-w-full sm:w-72 lg:mx-0 lg:w-80"
                        unoptimized
                    />
                    <h1 id="sign-in-heading" className="mx-auto mt-8 max-w-md text-3xl leading-tight tracking-tight text-foreground sm:text-4xl lg:mx-0 lg:mt-10 lg:text-5xl">
                        <span className="font-extrabold">{t("headline")}</span>
                        <span className="mt-1 block font-normal">{t("headlineEnd")}</span>
                    </h1>
                    <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0 lg:mt-7">
                        {t("description")}
                    </p>
                    {/* ponytail: keep the desktop artwork space empty until the designer supplies the child/bus image. */}
                    <div aria-hidden="true" className="hidden lg:block lg:h-48 xl:h-64" />
                </section>
                <div className="mx-auto w-full min-w-0 max-w-sm motion-safe:animate-fade-in-up motion-safe:animate-duration-500 lg:justify-self-end">
                    <SignIn appearance={{ elements: { rootBox: "w-full", cardBox: "w-full max-w-sm" } }} />
                </div>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 hidden h-80 w-96 rounded-[50%] bg-info lg:block" />
            <BrandWaves className="lg:right-auto lg:h-64 lg:w-3/5 lg:[mask-image:linear-gradient(to_right,black_65%,transparent)] xl:h-80" />
        </main>
    )
}
