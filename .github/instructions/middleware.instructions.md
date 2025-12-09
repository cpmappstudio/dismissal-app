---
title: clerkMiddleware() | Next.js
description: The clerkMiddleware() function allows you to protect your Next.js application using Middleware.
sdk: nextjs
sdkScoped: "true"
canonical: /docs/reference/nextjs/clerk-middleware
lastUpdated: 2025-11-12T20:41:06.000Z
availableSdks: nextjs
notAvailableSdks: react,js-frontend,chrome-extension,expo,android,ios,expressjs,fastify,react-router,remix,tanstack-react-start,go,astro,nuxt,vue,ruby,js-backend
activeSdk: nextjs
sourceFile: /docs/reference/nextjs/clerk-middleware.mdx
---

The `clerkMiddleware()` helper integrates Clerk authentication into your Next.js application through Middleware. `clerkMiddleware()` is compatible with both the App and Pages routers.

## Configure `clerkMiddleware()`

<If sdk="nextjs">
  > \[!IMPORTANT]
  >
  > If you're using Next.js ≤15, name your file `middleware.ts` instead of `proxy.ts`. The code itself remains the same; only the filename changes.
</If>

Create a `proxy.ts` file at the root of your project, or in your `src/` directory if you have one.

> \[!NOTE]
> For more information about Middleware in Next.js, see the [Next.js documentation](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

```tsx {{ filename: 'proxy.ts' }}
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

By default, `clerkMiddleware` will not protect any routes. All routes are public and you must opt-in to protection for routes.

## `createRouteMatcher()`

`createRouteMatcher()` is a Clerk helper function that allows you to protect multiple routes. `createRouteMatcher()` accepts an array of routes and checks if the route the user is trying to visit matches one of the routes passed to it. The paths provided to this helper can be in the same format as the paths provided to the Next Middleware matcher.

The `createRouteMatcher()` helper returns a function that, if called with the `req` object from the Middleware, will return `true` if the user is trying to access a route that matches one of the routes passed to `createRouteMatcher()`.

In the following example, `createRouteMatcher()` sets all `/dashboard` and `/forum` routes as protected routes.

```tsx
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/forum(.*)'])
```

## Protect routes

You can protect routes using either or both of the following:

* [Authentication-based protection](#protect-routes-based-on-authentication-status): Verify if the user is signed in.
* [Authorization-based protection](#protect-routes-based-on-authorization-status): Verify if the user has the required organization roles or custom permissions.

> \[!TIP]
> If you have a `<Link>` tag on a public page that points to a protected page that returns a `400`-level error, like a `401`, the data prefetch will fail because it will be redirected to the sign-in page and throw a confusing error in the console. To prevent this behavior, disable prefetching by adding `prefetch={false}` to the `<Link>` component.

### Protect routes based on authentication status

You can protect routes based on a user's authentication status by checking if the user is signed in.

There are two methods that you can use:

* Use [`auth.protect()`](/docs/reference/nextjs/app-router/auth#auth-protect) if you want to redirect unauthenticated users to the sign-in route automatically.
* Use [`auth().isAuthenticated`](/docs/reference/nextjs/app-router/auth#protect-pages-and-routes) if you want more control over what your app does based on user authentication status.

<CodeBlockTabs options={["auth.protect()", "auth().isAuthenticated()"]}>
  ```tsx {{ filename: 'proxy.ts' }}
  import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

  const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/forum(.*)'])

  export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
  })

  export const config = {
    matcher: [
      // Skip Next.js internals and all static files, unless found in search params
      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      // Always run for API routes
      '/(api|trpc)(.*)',
    ],
  }
  ```

  ```tsx {{ filename: 'proxy.ts' }}
  import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

  const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/forum(.*)'])

  export default clerkMiddleware(async (auth, req) => {
    const { isAuthenticated, redirectToSignIn } = await auth()

    if (!isAuthenticated && isProtectedRoute(req)) {
      // Add custom logic to run before redirecting

      return redirectToSignIn()
    }
  })

  export const config = {
    matcher: [
      // Skip Next.js internals and all static files, unless found in search params
      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      // Always run for API routes
      '/(api|trpc)(.*)',
    ],
  }
  ```
</CodeBlockTabs>

### Protect routes based on authorization status

You can protect routes based on a user's authorization status by checking if the user has the required roles or permissions.

There are two methods that you can use:

* Use [`auth.protect()`](/docs/reference/nextjs/app-router/auth#auth-protect) if you want Clerk to return a `404` if the user does not have the role or permission.
* Use <SDKLink href="/docs/reference/backend/types/auth-object#has" sdks={["js-backend"]} code={true}>auth().has()</SDKLink> if you want more control over what your app does based on the authorization status.

<Tabs items={["auth.protect()", "auth().has()"]}>
  <Tab>
    ```tsx {{ filename: 'proxy.ts' }}
    import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

    const isProtectedRoute = createRouteMatcher(['/admin(.*)'])

    export default clerkMiddleware(async (auth, req) => {
      // Restrict admin routes to users with specific permissions
      if (isProtectedRoute(req)) {
        await auth.protect((has) => {
          return has({ permission: 'org:admin:example1' }) || has({ permission: 'org:admin:example2' })
        })
      }
    })

    export const config = {
      matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
      ],
    }
    ```
  </Tab>

  <Tab>
    > \[!WARNING]
    > Using `has()` **on the server-side** to check permissions works only with **custom permissions**, as [system permissions](/docs/guides/organizations/roles-and-permissions#system-permissions) aren't included in the session token claims. To check system permissions, verify the user's role instead.

    ```tsx {{ filename: 'proxy.ts' }}
    import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

    const isProtectedRoute = createRouteMatcher(['/admin(.*)'])

    export default clerkMiddleware(async (auth, req) => {
      const { has, redirectToSignIn } = await auth()
      // Restrict admin routes to users with specific permissions
      if (
        (isProtectedRoute(req) && !has({ permission: 'org:admin:example1' })) ||
        !has({ permission: 'org:admin:example2' })
      ) {
        // Add logic to run if the user does not have the required permissions

        return redirectToSignIn()
      }
    })

    export const config = {
      matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
      ],
    }
    ```
  </Tab>
</Tabs>

## Protect multiple groups of routes

You can use more than one `createRouteMatcher()` in your application if you have two or more groups of routes.

The following example uses the <SDKLink href="/docs/reference/backend/types/auth-object#has" sdks={["js-backend"]} code={true}>has()</SDKLink> method from the `auth()` helper.

> \[!TIP]
> If you have a `<Link>` tag on a public page that points to a protected page that returns a `400`-level error, like a `401`, the data prefetch will fail because it will be redirected to the sign-in page and throw a confusing error in the console. To prevent this behavior, disable prefetching by adding `prefetch={false}` to the `<Link>` component.

```tsx {{ filename: 'proxy.ts' }}
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isTenantRoute = createRouteMatcher(['/organization-selector(.*)', '/orgid/(.*)'])

const isTenantAdminRoute = createRouteMatcher(['/orgId/(.*)/memberships', '/orgId/(.*)/domain'])

export default clerkMiddleware(async (auth, req) => {
  // Restrict admin routes to users with specific permissions
  if (isTenantAdminRoute(req)) {
    await auth.protect((has) => {
      return has({ permission: 'org:admin:example1' }) || has({ permission: 'org:admin:example2' })
    })
  }
  // Restrict organization routes to signed in users
  if (isTenantRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

## Protect all routes

To protect all routes in your application and define specific routes as public, you can use any of the above methods and simply invert the `if` condition.

> \[!TIP]
> If you have a `<Link>` tag on a public page that points to a protected page that returns a `400`-level error, like a `401`, the data prefetch will fail because it will be redirected to the sign-in page and throw a confusing error in the console. To prevent this behavior, disable prefetching by adding `prefetch={false}` to the `<Link>` component.

```tsx {{ filename: 'proxy.ts' }}
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

## Protect routes based on token types

You can protect routes based on token types by checking if the request includes the required token (e.g. OAuth token, API key, machine token or session token). This ensures that only requests with the appropriate token type can access the route.

The following example uses the [`protect()`](/docs/reference/nextjs/app-router/auth#auth-protect) method from the `auth()` helper. Requests without the required token will return an appropriate error:

* A `404` error for unauthenticated requests with a session token type.
* A `401` error for unauthenticated requests with machine token types.

```tsx {{ filename: 'proxy.ts' }}
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Create route matchers to identify which token type each route should require
const isOAuthAccessible = createRouteMatcher(['/oauth(.*)'])
const isApiKeyAccessible = createRouteMatcher(['/api(.*)'])
const isMachineTokenAccessible = createRouteMatcher(['/m2m(.*)'])
const isUserAccessible = createRouteMatcher(['/user(.*)'])
const isAccessibleToAnyValidToken = createRouteMatcher(['/any(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Check if the request matches each route and enforce the corresponding token type
  if (isOAuthAccessible(req)) await auth.protect({ token: 'oauth_token' })
  if (isApiKeyAccessible(req)) await auth.protect({ token: 'api_key' })
  if (isMachineTokenAccessible(req)) await auth.protect({ token: 'm2m_token' })
  if (isUserAccessible(req)) await auth.protect({ token: 'session_token' })

  if (isAccessibleToAnyValidToken(req)) await auth.protect({ token: 'any' })
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

## Debug your Middleware

If you are having issues getting your Middleware dialed in, or are trying to narrow down auth-related issues, you can use the debugging feature in `clerkMiddleware()`. Add `{ debug: true }` to `clerkMiddleware()` and you will get debug logs in your terminal.

```tsx {{ filename: 'proxy.ts', mark: [[4, 7]] }}
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware(
  (auth, req) => {
    // Add your middleware checks
  },
  { debug: true },
)

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

If you would like to set up debugging for your development environment only, you can use the `process.env.NODE_ENV` variable to conditionally enable debugging. For example, `{ debug: process.env.NODE_ENV === 'development' }`.

## Combine Middleware

You can combine other Middleware with Clerk's Middleware by returning the second Middleware from `clerkMiddleware()`.

```js {{ filename: 'proxy.ts' }}
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createMiddleware from 'next-intl/middleware'

import { AppConfig } from './utils/AppConfig'

const intlMiddleware = createMiddleware({
  locales: AppConfig.locales,
  localePrefix: AppConfig.localePrefix,
  defaultLocale: AppConfig.defaultLocale,
})

const isProtectedRoute = createRouteMatcher(['dashboard/(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect()

  return intlMiddleware(req)
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

## `clerkMiddleware()` options

The `clerkMiddleware()` function accepts an optional object. The following options are available:

<Properties>
  * `audience?`
  * `string | string[]`

  A string or list of [audiences](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3). If passed, it is checked against the `aud` claim in the token.

  ***

  * `authorizedParties?`
  * `string[]`

  An allowlist of origins to verify against, to protect your application from the subdomain cookie leaking attack. For example: `['http://localhost:3000', 'https://example.com']`

  ***

  * `clockSkewInMs?`
  * `number`

  Specifies the allowed time difference (in milliseconds) between the Clerk server (which generates the token) and the clock of the user's application server when validating a token. Defaults to 5000 ms (5 seconds).

  ***

  * `domain?`
  * `string`

  The domain used for satellites to inform Clerk where this application is deployed.

  ***

  * `isSatellite?`
  * `boolean`

  When using Clerk's satellite feature, this should be set to `true` for secondary domains.

  ***

  * `jwtKey`
  * `string`

  Used to verify the session token in a networkless manner. Supply the **JWKS Public Key** from the [**API keys**](https://dashboard.clerk.com/~/api-keys) page in the Clerk Dashboard. **It's recommended to use [the environment variable](/docs/guides/development/clerk-environment-variables) instead.** For more information, refer to [Manual JWT verification](/docs/guides/sessions/manual-jwt-verification).

  ***

  * `organizationSyncOptions?`
  * <code>[OrganizationSyncOptions](#organization-sync-options) | undefined</code>

  Used to activate a specific [organization](/docs/guides/organizations/overview) or [personal account](/docs/guides/dashboard/overview) based on URL path parameters. If there's a mismatch between the <Tooltip><TooltipTrigger>active organization</TooltipTrigger><TooltipContent>A user can be a member of multiple organizations, but only one can be active at a time. The **active organization** determines which organization-specific data the user can access and which role and related permissions they have within the organization.</TooltipContent></Tooltip> in the session (e.g., as reported by [`auth()`](/docs/reference/nextjs/app-router/auth)) and the organization indicated by the URL, the middleware will attempt to activate the organization specified in the URL.

  ***

  * `proxyUrl?`
  * `string`

  Specify the URL of the proxy, if using a proxy.

  ***

  * `signInUrl`
  * `string`

  The full URL or path to your sign-in page. Needs to point to your primary application on the client-side. **Required for a satellite application in a development instance.** It's recommended to use [the environment variable](/docs/guides/development/clerk-environment-variables#sign-in-and-sign-up-redirects) instead.

  ***

  * `signUpUrl`
  * `string`

  The full URL or path to your sign-up page. Needs to point to your primary application on the client-side. **Required for a satellite application in a development instance.** It's recommended to use [the environment variable](/docs/guides/development/clerk-environment-variables#sign-in-and-sign-up-redirects) instead.

  ***

  * `publishableKey`
  * `string`

  The Clerk Publishable Key for your instance. This can be found on the [**API keys**](https://dashboard.clerk.com/~/api-keys) page in the Clerk Dashboard.

  ***

  * `secretKey?`
  * `string`

  The Clerk Secret Key for your instance. This can be found on the [**API keys**](https://dashboard.clerk.com/~/api-keys) page in the Clerk Dashboard. The `CLERK_ENCRYPTION_KEY` environment variable must be set when providing `secretKey` as an option, refer to [Dynamic keys](#dynamic-keys).
</Properties>

It's also possible to dynamically set options based on the incoming request:

```ts {{ filename: 'proxy.ts' }}
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware(
  (auth, req) => {
    // Add your middleware checks
  },
  (req) => ({
    // Provide `domain` based on the request host
    domain: req.nextUrl.host,
  }),
)
```

### Dynamic keys

> \[!NOTE]
> Dynamic keys are not accessible on the client-side.

The following options, known as "Dynamic Keys," are shared to the Next.js application server through `clerkMiddleware`, enabling access by server-side helpers like [`auth()`](/docs/reference/nextjs/app-router/auth):

* `signUpUrl`
* `signInUrl`
* `secretKey`
* `publishableKey`

Dynamic keys are encrypted and shared during request time using a [AES encryption algorithm](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard). When providing a `secretKey`, the `CLERK_ENCRYPTION_KEY` environment variable is mandatory and used as the encryption key. If no `secretKey` is provided to `clerkMiddleware`, the encryption key defaults to `CLERK_SECRET_KEY`.

When providing `CLERK_ENCRYPTION_KEY`, it is recommended to use a 32-byte (256-bit), pseudorandom value. You can use `openssl` to generate a key:

```sh {{ filename: 'terminal' }}
openssl rand --hex 32
```

For multi-tenant applications, you can dynamically define Clerk keys depending on the incoming request. Here's an example:

```ts {{ filename: 'proxy.ts' }}
import { clerkMiddleware } from '@clerk/nextjs/server'

// You would typically fetch these keys from a external store or environment variables.
const tenantKeys = {
  tenant1: { publishableKey: 'pk_tenant1...', secretKey: 'sk_tenant1...' },
  tenant2: { publishableKey: 'pk_tenant2...', secretKey: 'sk_tenant2...' },
}

export default clerkMiddleware(
  (auth, req) => {
    // Add your middleware checks
  },
  (req) => {
    // Resolve tenant based on the request
    const tenant = getTenant(req)
    return tenantKeys[tenant]
  },
)
```

### `OrganizationSyncOptions`

The `organizationSyncOptions` property on the [`clerkMiddleware()`](#clerk-middleware-options) options
object has the type `OrganizationSyncOptions`, which has the following properties:

<Properties>
  * `organizationPatterns`
  * <code>[Pattern](#pattern)\[]</code>

  Specifies URL patterns that are organization-specific, containing an organization ID or slug as a path parameter. If a request
  matches this path, the organization identifier will be used to set that org as active.

  If the route also matches the `personalAccountPatterns` prop, this prop takes precedence.

  Patterns must have a path parameter named either `:id` (to match a Clerk organization ID) or `:slug` (to match a Clerk organization slug).

  > \[!WARNING]
  > If the organization can't be activated—either because it doesn't exist or the user lacks access—the previously <Tooltip><TooltipTrigger>active organization</TooltipTrigger><TooltipContent>A user can be a member of multiple organizations, but only one can be active at a time. The **active organization** determines which organization-specific data the user can access and which role and related permissions they have within the organization.</TooltipContent></Tooltip> will remain unchanged. Components must detect this case and provide an appropriate error and/or resolution pathway, such as calling `notFound()` or displaying an <SDKLink href="/docs/:sdk:/reference/components/organization/organization-switcher" sdks={["astro","chrome-extension","expo","nextjs","nuxt","react","react-router","remix","tanstack-react-start","vue","js-frontend"]} code={true}>\<OrganizationSwitcher /></SDKLink>.

  Common examples:

  * `["/orgs/:slug", "/orgs/:slug/(.*)"]`
  * `["/orgs/:id", "/orgs/:id/(.*)"]`
  * `["/app/:any/orgs/:slug", "/app/:any/orgs/:slug/(.*)"]`

  ***

  * `personalAccountPatterns`
  * <code>[Pattern](#pattern)\[]</code>

  URL patterns for resources that exist within the context of a user's [personal account](/docs/guides/organizations/overview#allow-personal-accounts).

  If the route also matches the `organizationPattern` prop, the `organizationPattern` prop takes precedence.

  Common examples:

  * `["/me", "/me/(.*)"]`
  * `["/user/:any", "/user/:any/(.*)"]`
</Properties>

### Pattern

A `Pattern` is a `string` that represents the structure of a URL path. In addition to any valid URL, it may include:

* Named path parameters prefixed with a colon (e.g., `:id`, `:slug`, `:any`).
* Wildcard token, `(.*)`, which matches the remainder of the path.

#### Examples

* `/orgs/:slug`

| URL | Matches | `:slug` value |
| - | - | - |
| `/orgs/acmecorp` | ✅ | `acmecorp` |
| `/orgs` | ❌ | n/a |
| `/orgs/acmecorp/settings` | ❌ | n/a |

* `/app/:any/orgs/:id`

| URL | Matches | `:id` value |
| - | - | - |
| `/app/petstore/orgs/org_123` | ✅ | `org_123` |
| `/app/dogstore/v2/orgs/org_123` | ❌ | n/a |

* `/personal-account/(.*)`

| URL | Matches |
| - | - |
| `/personal-account/settings` | ✅ |
| `/personal-account` | ❌ |


import Callout from '@/components/Callout';
import Details from '@/components/Details';
import {CourseVideoBanner} from '@/components/CourseBanner';

# Proxy / middleware

The `next-intl` middleware can be created via `createMiddleware`.

It receives a [`routing`](/docs/routing/configuration#define-routing) configuration and takes care of:

1. Locale negotiation
2. Applying relevant redirects & rewrites
3. Providing [alternate links](/docs/routing/configuration#alternate-links) for search engines

**Example:**

```tsx filename="proxy.ts"
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

**Note:** `proxy.ts` was called `middleware.ts` up until Next.js 16.

## Locale detection [#locale-detection]

The locale is negotiated based on your routing configuration, taking into account your settings for [`localePrefix`](/docs/routing/configuration#locale-prefix), [`domains`](/docs/routing/configuration#domains), [`localeDetection`](/docs/routing/configuration#locale-detection), and [`localeCookie`](/docs/routing/configuration#locale-cookie).

### Prefix-based routing (default) [#location-detection-prefix]

Prefer to watch a video?

<CourseVideoBanner
  className="mt-2"
  href="https://learn.next-intl.dev/chapters/06-routing/07-prefix-based"
  title="Prefix-based routing"
/>

By default, [prefix-based routing](/docs/routing/configuration#locale-prefix) is used to determine the locale of a request.

In this case, the locale is detected based on these priorities:

1. A locale prefix is present in the pathname (e.g. `/en/about`)
2. A cookie is present that contains a previously detected locale
3. A locale can be matched based on the [`accept-language` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
4. As a last resort, the `defaultLocale` is used

To change the locale, users can visit a prefixed route. This will take precedence over a previously matched locale that is saved in a cookie or the `accept-language` header and will update a previous cookie value.

**Example workflow:**

1. A user requests `/` and based on the `accept-language` header, the `en` locale is matched.
2. The user is redirected to `/en`.
3. The app renders `<Link locale="de" href="/">Switch to German</Link>` to allow the user to change the locale to `de`.
4. When the user clicks on the link, a request to `/de` is initiated.
5. The middleware will add a cookie to remember the preference for the `de` locale.
6. The user later requests `/` again and the middleware will redirect to `/de` based on the cookie.

<Details id="accept-language-matching">
<summary>Which algorithm is used to match the accept-language header against the available locales?</summary>

To determine the best-matching locale based on the available options from your app, the middleware uses the "best fit" algorithm of [`@formatjs/intl-localematcher`](https://www.npmjs.com/package/@formatjs/intl-localematcher). This algorithm is expected to provide better results than the more conservative "lookup" algorithm that is specified in [RFC 4647](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.4).

To illustrate this with an example, let's consider your app supports these locales:

1. `en-US`
2. `de-DE`

The "lookup" algorithm works by progressively removing subtags from the user's `accept-language` header until a match is found. This means that if the user's browser sends the `accept-language` header `en-GB`, the "lookup" algorithm will not find a match, resulting in the default locale being used.

In contrast, the "best fit" algorithm compares a _distance_ between the user's `accept-language` header and the available locales, while taking into consideration regional information. Due to this, the "best fit" algorithm is able to match `en-US` as the best-matching locale in this case.

</Details>

### Domain-based routing [#location-detection-domain]

Prefer to watch a video?

<CourseVideoBanner
  className="mt-2"
  href="https://learn.next-intl.dev/chapters/06-routing/06-domain-based"
  title="Domain-based routing"
/>

If you're using the [`domains`](/docs/routing/configuration#domains) setting, the middleware will match the request against the available domains to determine the best-matching locale. To retrieve the domain, the host is read from the `x-forwarded-host` header, with a fallback to `host` (hosting platforms typically provide these headers out of the box).

The locale is detected based on these priorities:

1. A locale prefix is present in the pathname (e.g. `ca.example.com/fr`)
2. A locale is stored in a cookie and is supported on the domain
3. A locale that the domain supports is matched based on the [`accept-language` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language)
4. As a fallback, the `defaultLocale` of the domain is used

Since the middleware is aware of all your domains, if a domain receives a request for a locale that is not supported (e.g. `en.example.com/fr`), it will redirect to an alternative domain that does support the locale.

**Example workflow:**

1. The user requests `us.example.com` and based on the `defaultLocale` of this domain, the `en` locale is matched.
2. The app renders `<Link locale="fr" href="/">Switch to French</Link>` to allow the user to change the locale to `fr`.
3. When the link is clicked, a request to `us.example.com/fr` is initiated.
4. The middleware recognizes that the user wants to switch to another domain and responds with a redirect to `ca.example.com/fr`.

## Matcher config

The middleware is intended to only run on pages, not on arbitrary files that you serve independently of the user locale (e.g. `/favicon.ico`).

A popular strategy is to match all routes that don't start with certain segments (e.g. `/_next`) and also none that include a dot (`.`) since these typically indicate static files. However, if you have some routes where a dot is expected (e.g. `/users/jane.doe`), you should explicitly provide a matcher for these.

```tsx filename="proxy.ts"
export const config = {
  // Matcher entries are linked with a logical "or", therefore
  // if one of them matches, the middleware will be invoked.
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',

    // However, match all pathnames within `/users`, optionally with a locale prefix
    '/([\\w-]+)?/users/(.+)'
  ]
};
```

{/* Keep this in sync with `packages/next-intl/test/middleware/middleware.test.tsx` */}

Note that some third-party providers like [Vercel Analytics](https://vercel.com/analytics) typically use internal endpoints that are then rewritten to an external URL (e.g. `/_vercel/insights/view`). Make sure to exclude such requests from your middleware matcher so they aren't rewritten by accident.

## Composing other middlewares

By calling `createMiddleware`, you'll receive a function of the following type:

```tsx
function middleware(request: NextRequest): NextResponse;
```

If you need to incorporate additional behavior, you can either modify the request before the `next-intl` middleware receives it, modify the response or even create the middleware based on dynamic configuration.

```tsx filename="proxy.ts"
import createMiddleware from 'next-intl/middleware';
import {NextRequest} from 'next/server';

export default async function proxy(request: NextRequest) {
  // Step 1: Use the incoming request (example)
  const defaultLocale = request.headers.get('x-your-custom-locale') || 'en';

  // Step 2: Create and call the next-intl middleware (example)
  const handleI18nRouting = createMiddleware({
    locales: ['en', 'de'],
    defaultLocale
  });
  const response = handleI18nRouting(request);

  // Step 3: Alter the response (example)
  response.headers.set('x-your-custom-locale', defaultLocale);

  return response;
}

export const config = {
  // Match only internationalized pathnames
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

### Example: Additional rewrites

If you need to handle rewrites apart from the ones provided by `next-intl`, you can call [`NextResponse.rewrite()`](https://nextjs.org/docs/app/api-reference/functions/next-response#rewrite) conditionally after the `next-intl` middleware has run.

This example rewrites requests for `/[locale]/profile` to `/[locale]/profile/new` if a special cookie is set.

```tsx filename="proxy.ts"
import createMiddleware from 'next-intl/middleware';
import {NextRequest, NextResponse} from 'next/server';
import {routing} from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  let response = handleI18nRouting(request);

  // Additional rewrite when NEW_PROFILE cookie is set
  if (response.ok) {
    // (not for errors or redirects)
    const [, locale, ...rest] = new URL(
      response.headers.get('x-middleware-rewrite') || request.url
    ).pathname.split('/');
    const pathname = '/' + rest.join('/');

    if (
      pathname === '/profile' &&
      request.cookies.get('NEW_PROFILE')?.value === 'true'
    ) {
      response = NextResponse.rewrite(
        new URL(`/${locale}/profile/new`, request.url),
        {headers: response.headers}
      );
    }
  }

  return response;
}

export const config = {
  // Match only internationalized pathnames
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

You may wish to customize this based on your routing configuration and use case.

### Example: Integrating with Clerk

[`@clerk/nextjs`](https://clerk.com/docs/references/nextjs/overview) provides a middleware that can be [combined](https://clerk.com/docs/references/nextjs/clerk-middleware#combine-middleware) with other middlewares like the one provided by `next-intl`. By combining them, the middleware from `@clerk/next` will first ensure protected routes are handled appropriately. Subsequently, the middleware from `next-intl` will run, potentially redirecting or rewriting incoming requests.

```tsx filename="proxy.ts"
import {clerkMiddleware, createRouteMatcher} from '@clerk/nextjs/server';
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

const isProtectedRoute = createRouteMatcher(['/:locale/dashboard(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();

  return handleI18nRouting(req);
});

export const config = {
  // Match only internationalized pathnames
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

(based on `@clerk/nextjs@^6.0.0`)

### Example: Integrating with Supabase Authentication

In order to use Supabase Authentication with `next-intl`, you need to combine the Supabase middleware with the one from `next-intl`.

You can do so by following the [setup guide from Supabase](https://supabase.com/docs/guides/auth/server-side/nextjs?router=app) and adapting the middleware utils to accept a response object that's been created by the `next-intl` middleware instead of creating a new one:

```tsx filename="utils/supabase/middleware.ts"
import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';

export async function updateSession(
  request: NextRequest,
  response: NextResponse
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name, value}) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({name, value, options}) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: {user}
  } = await supabase.auth.getUser();

  return response;
}
```

Now, we can integrate the Supabase middleware with the one from `next-intl`:

```tsx filename="proxy.ts"
import createMiddleware from 'next-intl/middleware';
import {type NextRequest} from 'next/server';
import {routing} from './i18n/routing';
import {updateSession} from './utils/supabase/middleware';

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  // A `response` can now be passed here
  return await updateSession(request, response);
}

export const config = {
  // Match only internationalized pathnames
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

(based on `@supabase/ssr@^0.5.0`)

### Example: Integrating with Auth.js (aka NextAuth.js) [#example-auth-js]

The [Auth.js](https://authjs.dev/) middleware requires an integration with their control flow to be compatible with other middlewares. The [success callback](https://next-auth.js.org/configuration/nextjs#wrap-middleware) can be used to run the `next-intl` middleware on authorized pages. However, public pages need to be treated separately.

For pathnames specified in the [`pages` object](https://next-auth.js.org/configuration/nextjs#pages) (e.g. `signIn`), Auth.js will skip the entire middleware and not run the success callback. Therefore, we have to detect these pages before running the Auth.js middleware and only run the `next-intl` middleware in this case.

```tsx filename="proxy.ts"
import {withAuth} from 'next-auth/middleware';
import createMiddleware from 'next-intl/middleware';
import {NextRequest} from 'next/server';
import {routing} from './i18n/routing';

const publicPages = ['/', '/login'];

const handleI18nRouting = createMiddleware(routing);

const authMiddleware = withAuth(
  // Note that this callback is only invoked if
  // the `authorized` callback has returned `true`
  // and not for pages listed in `pages`.
  function onSuccess(req) {
    return handleI18nRouting(req);
  },
  {
    callbacks: {
      authorized: ({token}) => token != null
    },
    pages: {
      signIn: '/login'
    }
  }
);

export default function proxy(req: NextRequest) {
  const publicPathnameRegex = RegExp(
    `^(/(${locales.join('|')}))?(${publicPages
      .flatMap((p) => (p === '/' ? ['', '/'] : p))
      .join('|')})/?$`,
    'i'
  );
  const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname);

  if (isPublicPage) {
    return handleI18nRouting(req);
  } else {
    return (authMiddleware as any)(req);
  }
}

export const config = {
  // Match only internationalized pathnames
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

(based on `next-auth@^4.0.0`)

<Callout>

Have a look at the [`next-intl` with NextAuth.js example](/examples#app-router-next-auth) to explore a working setup.

</Callout>

## Usage without proxy / middleware (static export)

If you're using the [static export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports) feature from Next.js (`output: 'export'`), a proxy / middleware will not run. You can use [prefix-based routing](/docs/routing/configuration#locale-prefix) nontheless to internationalize your app, but a few tradeoffs apply.

**Static export limitations:**

1. Using a locale prefix is required (same as [`localePrefix: 'always'`](/docs/routing/configuration#locale-prefix-always))
2. The locale can't be negotiated on the server (same as [`localeDetection: false`](/docs/routing/configuration#locale-detection))
3. You can't use [`pathnames`](/docs/routing/configuration#pathnames), as these require server-side rewrites
4. [Static rendering](/docs/routing/setup#static-rendering) is required

Additionally, other [limitations as documented by Next.js](https://nextjs.org/docs/app/building-your-application/deploying/static-exports#unsupported-features) will apply too.

If you choose this approach, you might want to enable a redirect at the root of your app:

```tsx filename="app/page.tsx"
import {redirect} from 'next/navigation';

// Redirect the user to the default locale when `/` is requested
export default function RootPage() {
  redirect('/en');
}
```

If you add such a root page at `app/page.tsx`, you need to add a root layout at `app/layout.tsx` as well, even if it's just passing `children` through:

```tsx filename="app/layout.tsx"
export default function RootLayout({children}) {
  return children;
}
```

## Troubleshooting

### "The proxy / middleware doesn't run for a particular page." [#middleware-not-running]

To resolve this, make sure that:

1. The [proxy / middleware](/docs/routing/setup#proxy) is set up in the correct file (e.g. `src/proxy.ts`).
2. Your [`matcher`](#matcher-config) correctly matches all routes of your application, including dynamic segments with potentially unexpected characters like dots (e.g. `/users/jane.doe`).
3. In case you're [composing other middlewares](#composing-other-middlewares), ensure that the middleware is called correctly.
4. In case you require static rendering, make sure to follow the [static rendering guide](/docs/routing/setup#static-rendering) instead of relying on hacks like [`force-static`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic).

### "My page content isn't localized despite the pathname containing a locale prefix." [#content-not-localized]

This is very likely the result of your [proxy / middleware not running](#middleware-not-running) on the request. As a result, a potential fallback from [`i18n/request.ts`](/docs/usage/configuration#i18n-request) might be applied.

### "Unable to find `next-intl` locale because the proxy / middleware didn't run on this request and no `locale` was returned in `getRequestConfig`." [#unable-to-find-locale]

If the middleware _is not_ expected to run on this request (e.g. because you're using a setup without locale-based routing, you should explicitly return a `locale` from [`getRequestConfig`](/docs/usage/configuration#i18n-request) to recover from this error.

If the middleware _is_ expected to run, verify that your [middleware is set up correctly](#middleware-not-running).

Note that `next-intl` will invoke the `notFound()` function to abort the render if no locale is available after `getRequestConfig` has run. You should consider adding a [`not-found` page](/docs/environments/error-files#not-foundjs) due to this.