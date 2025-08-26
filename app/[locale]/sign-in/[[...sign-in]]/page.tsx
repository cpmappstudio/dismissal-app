import { SignIn } from "@clerk/nextjs"
// import Image from "next/image"

export default function SignInPage() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 bg-yankees-blue">
            <div className="flex w-full max-w-sm flex-col gap-6 animate-fade-in-up animate-delay-500 animate-duration-700">
                <SignIn />
            </div>
        </div>
    )
}
