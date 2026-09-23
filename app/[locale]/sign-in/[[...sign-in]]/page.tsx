import { SignIn } from "@clerk/nextjs"
import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { BrandWaves } from "@/components/brand-waves"

export default async function SignInPage() {
    const t = await getTranslations("signInPage")

    return (
        <main className="relative isolate min-h-svh overflow-hidden bg-card lg:min-h-[max(48rem,100svh)]">
            <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-[5%] hidden h-[82%] w-[72%] lg:block xl:left-[12%]">
                <Image
                    src="/bg-bus.webp"
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 72vw, 1px"
                    className="object-cover object-left-bottom"
                />
                {/* Match the photo's cover alignment; the cutout restores the child above the blue shape. */}
                <svg aria-hidden="true" focusable="false" viewBox="0 0 5521 3681" preserveAspectRatio="xMinYMax slice" className="absolute inset-0 z-[2] h-full w-full">
                    <image href="/kid.webp" x="948" y="1028" width="2024" height="2653" />
                </svg>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 z-10 h-44 w-64 rounded-[50%] bg-info sm:-right-32 sm:-top-48 sm:h-80 sm:w-[28rem]" />
            <div className="relative z-20 mx-auto grid min-h-svh w-full max-w-[100rem] grid-cols-1 items-center gap-10 px-6 pb-32 pt-12 sm:px-10 sm:pb-44 sm:pt-16 lg:min-h-[max(48rem,100svh)] lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-12 lg:py-16 xl:px-20">
                <section className="min-w-0 text-center lg:self-stretch lg:pt-4 lg:text-left" aria-labelledby="sign-in-heading">
                    <Image
                        src="/oficial-logo.svg"
                        alt="Dismissal"
                        width={1349}
                        height={395}
                        className="mx-auto h-auto w-56 max-w-full sm:w-72 lg:mx-0 lg:w-80"
                        unoptimized
                    />
                    <h1 id="sign-in-heading" className="mx-auto mt-8 max-w-md text-3xl leading-tight tracking-tight text-foreground sm:text-4xl lg:mx-0 lg:mt-10 lg:max-w-[18rem] xl:max-w-sm xl:text-5xl">
                        <span className="font-extrabold">{t("headline")}</span>
                        <span className="mt-1 block font-normal">{t("headlineEnd")}</span>
                    </h1>
                    <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0 lg:mt-7 lg:max-w-[16rem] xl:max-w-[19rem]">
                        {t("description")}
                    </p>
                </section>
                <div className="mx-auto w-full min-w-0 max-w-sm motion-safe:animate-fade-in-up motion-safe:animate-duration-500 lg:mx-0 lg:self-center lg:justify-self-end">
                    <SignIn appearance={{ elements: { rootBox: "w-full", cardBox: "w-full max-w-sm" } }} />
                </div>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-[12vw] -left-[3vw] z-[1] hidden h-[30vw] w-[36vw] rounded-[50%] bg-info lg:block" />
            <BrandWaves variant="sign-in" className="z-10 lg:right-auto lg:h-[23vw] lg:w-[40vw]" />
        </main>
    )
}
