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

// This page should never be reached due to middleware redirects
// But keeping it as fallback
export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="text-muted-foreground">
          If you see this, something went wrong with the redirect.
        </p>
      </div>
    </div>
  );
}


