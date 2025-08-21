"use client";

// ################################################################################
// # File: page.tsx                                                               # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/17/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * HISTORY: Alef University’s student information system (SIS). A Next.js 
 * application with a clean and scalable architecture, designed to manage students grades, 
 * programs, courses, and transcripts.
 */

import {
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
// import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Convex + Next.js + Clerk
        <UserButton />
      </header>
      <main className="p-8 flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-center">
          Convex + Next.js + Clerk
        </h1>
        <ModeToggle />
        <Authenticated>
          <Content />
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInForm() {
  return (
    <div className="flex flex-col gap-8 w-96 mx-auto">
      <p>Log in to see the numbers</p>
      <SignInButton mode="modal">
        <button className="bg-foreground text-background px-4 py-2 rounded-md">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="bg-foreground text-background px-4 py-2 rounded-md">
          Sign up
        </button>
      </SignUpButton>
    </div>
  );
}

function Content() {


  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <p>
        Click the button below and open this page in another window - this data
        is persisted in the Convex cloud database!
      </p>
    </div>
  );
}

function ResourceCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-4 rounded-md h-28 overflow-auto">
      <a href={href} className="text-sm underline hover:no-underline">
        {title}
      </a>
      <p className="text-xs">{description}</p>
    </div>
  );
}
