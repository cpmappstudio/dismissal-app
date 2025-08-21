import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

// ################################################################################
// # File: page.tsx                                                               # 
// # Authors: Juan Camilo Narváez Tascón (github.com/ulvenforst)                  #
// # Creation date: 08/17/2025                                                    #
// # License: Apache License 2.0                                                  #
// ################################################################################

/**
 * HISTORY: Alef University's student information system (SIS). A Next.js 
 * application with a clean and scalable architecture, designed to manage students grades, 
 * programs, courses, and transcripts.
 */

export default async function HomePage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/dashboard')
  } else {
    redirect('/sign-in')
  }
}