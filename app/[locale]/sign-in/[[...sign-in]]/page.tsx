import { SignIn } from "@clerk/nextjs"
import { BrandWaves } from "@/components/brand-waves"

export default function SignInPage() {
    return (
        <div className="relative isolate flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-28 sm:px-6 sm:py-44">
            <div className="relative z-10 flex w-full max-w-sm min-w-0 flex-col gap-6 motion-safe:animate-fade-in-up motion-safe:animate-duration-500">
                <SignIn appearance={{ elements: { rootBox: "w-full", cardBox: "w-full max-w-sm" } }} />
            </div>
            <BrandWaves />
        </div>
    )
}
