import { SignIn } from "@clerk/nextjs"
import { shadcn } from "@clerk/themes"
import Image from "next/image"

export default function SignInPage() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 bg-[radial-gradient(circle_at_top_right,_var(--color-fuzzy-wuzzy)_0%,_var(--color-deep-koamaru)_50%)]">
            <div className="flex w-full max-w-sm flex-col gap-6 animate-fade-in-up animate-delay-500 animate-duration-700">
                <a href="https://www.alef.university/" target="_blank" className="flex items-center gap-2 self-center text-lg font-medium font-serif antialiased">
                    <div className="">
                        <Image
                            src="/alef-transparent.png"
                            alt="Alef University"
                            width={46}
                            height={46}
                            className="object-contain"
                        />
                    </div>
                    <div className="flex flex-col leading-tight text-white">
                        <span className="font-bold">Alef</span>
                        <span>University</span>
                    </div>
                </a>
                <SignIn
                    routing="path"
                    path="/sign-in"
                    appearance={{ baseTheme: shadcn }}
                />
            </div>
        </div>
    )
}
