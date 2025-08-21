import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/login"]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  try {
    // Get auth state once to avoid multiple calls
    const { userId } = await auth();
    const isAuthenticated = !!userId;

    // Handle root route redirection
    if (pathname === '/') {
      const redirectUrl = isAuthenticated ? '/dashboard' : '/login';
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    // Allow public routes
    if (isPublicRoute(req)) {
      return NextResponse.next();
    }

    // Protect all other routes
    if (!isAuthenticated) {
      // Let Clerk handle the redirect to sign-in
      await auth.protect();
    }

    return NextResponse.next();

  } catch (error) {
    // Handle auth errors gracefully
    console.error('Auth middleware error:', error);

    // If it's root route and auth failed, go to login
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // For protected routes, let Clerk handle the error
    if (!isPublicRoute(req)) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
