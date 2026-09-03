# Domain management for multi-tenant

Learn how to programmatically manage domains for your multi-tenant application using Vercel for Platforms.

## [Using wildcard domains](#using-wildcard-domains)

If you plan on offering subdomains like `*.acme.com`, add a wildcard domain to your Vercel project. This requires using [Vercel's nameservers](https://vercel.com/docs/projects/domains/working-with-nameservers) so that Vercel can manage the DNS challenges necessary for generating wildcard SSL certificates.

1.  Point your domain to Vercel's nameservers (`ns1.vercel-dns.com` and `ns2.vercel-dns.com`).
2.  In your Vercel project settings, add the apex domain (e.g., `acme.com`).
3.  Add a wildcard domain: `.acme.com`.

Now, any `tenant.acme.com` you create—whether it's `tenant1.acme.com` or `docs.tenant1.acme.com`—automatically resolves to your Vercel deployment. Vercel issues individual certificates for each subdomain on the fly.

## [Offering custom domains](#offering-custom-domains)

You can also give tenants the option to bring their own domain. In that case, you'll want your code to:

1.  Provision and assign the tenant's domain to your Vercel project.
2.  Verify the domain (to ensure the tenant truly owns it).
3.  Automatically generate an SSL certificate.

## [Adding a domain programmatically](#adding-a-domain-programmatically)

You can add a new domain through the [Vercel SDK](https://vercel.com/docs/sdk). For example:

```
import { VercelCore as Vercel } from '@vercel/sdk/core.js';
import { projectsAddProjectDomain } from '@vercel/sdk/funcs/projectsAddProjectDomain.js';
 
const vercel = new Vercel({
  bearerToken: process.env.VERCEL_TOKEN,
});
 
// The 'idOrName' is your project name in Vercel, for example: 'multi-tenant-app'
await projectsAddProjectDomain(vercel, {
  idOrName: 'my-multi-tenant-app',
  teamId: 'team_1234',
  requestBody: {
    // The tenant's custom domain
    name: 'customacmesite.com',
  },
});
```

Once the domain is added, Vercel attempts to issue an SSL certificate automatically.

## [Verifying domain ownership](#verifying-domain-ownership)

If the domain is already in use on Vercel, the user needs to set a TXT record to prove ownership of it.

You can check the verification status and trigger manual verification:

```
import { VercelCore as Vercel } from '@vercel/sdk/core.js';
import { projectsGetProjectDomain } from '@vercel/sdk/funcs/projectsGetProjectDomain.js';
import { projectsVerifyProjectDomain } from '@vercel/sdk/funcs/projectsVerifyProjectDomain.js';
 
const vercel = new Vercel({
  bearerToken: process.env.VERCEL_TOKEN,
});
 
const domain = 'customacmesite.com';
 
const [domainResponse, verifyResponse] = await Promise.all([
  projectsGetProjectDomain(vercel, {
    idOrName: 'my-multi-tenant-app',
    teamId: 'team_1234',
    domain,
  }),
  projectsVerifyProjectDomain(vercel, {
    idOrName: 'my-multi-tenant-app',
    teamId: 'team_1234',
    domain,
  }),
]);
 
const { value: result } = verifyResponse;
 
if (!result?.verified) {
  console.log(`Domain verification required for ${domain}.`);
  // You can prompt the tenant to add a TXT record or switch nameservers.
}
```

## [Handling redirects and apex domains](#handling-redirects-and-apex-domains)

### [Redirecting between apex and "www"](#redirecting-between-apex-and-www)

Some tenants might want `www.customacmesite.com` to redirect automatically to their apex domain `customacmesite.com`, or the other way around.

1.  Add both `customacmesite.com` and `www.customacmesite.com` to your Vercel project.
2.  Configure a redirect for `www.customacmesite.com` to the apex domain by setting `redirect: customacmesite.com` through the API or your Vercel dashboard.

This ensures a consistent user experience and prevents issues with duplicate content.

### [Avoiding duplicate content across subdomains](#avoiding-duplicate-content-across-subdomains)

If you offer both `tenant.acme.com` and `customacmesite.com` for the same tenant, you may want to redirect the subdomain to the custom domain (or vice versa) to avoid search engine duplicate content. Alternatively, set a canonical URL in your HTML `<head>` to indicate which domain is the "official" one.

## [Deleting or removing domains](#deleting-or-removing-domains)

If a tenant cancels or no longer needs their custom domain, you can remove it from your Vercel account using the SDK:

```
import { VercelCore as Vercel } from '@vercel/sdk/core.js';
import { projectsRemoveProjectDomain } from '@vercel/sdk/funcs/projectsRemoveProjectDomain.js';
import { domainsDeleteDomain } from '@vercel/sdk/funcs/domainsDeleteDomain.js';
 
const vercel = new Vercel({
  bearerToken: process.env.VERCEL_TOKEN,
});
 
await Promise.all([
  projectsRemoveProjectDomain(vercel, {
    idOrName: 'my-multi-tenant-app',
    teamId: 'team_1234',
    domain: 'customacmesite.com',
  }),
  domainsDeleteDomain(vercel, {
    domain: 'customacmesite.com',
  }),
]);
```

The first call disassociates the domain from your project, and the second removes it from your account entirely.

## [Troubleshooting common issues](#troubleshooting-common-issues)

Here are a few common issues you might run into and how to solve them:

DNS propagation delays

After pointing your nameservers to Vercel or adding CNAME records, changes can take 24–48 hours to propagate. Use [WhatsMyDNS](https://www.whatsmydns.net/) to confirm updates worldwide.

Forgetting to verify domain ownership

If you add a tenant's domain but never verify it (e.g., by adding a `TXT` record or using Vercel nameservers), SSL certificates won't be issued. Always check the domain's status in your Vercel project or with the SDK.

Wildcard domain requires Vercel nameservers

If you try to add `.acme.com` without pointing to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`, wildcard SSL won't work. Make sure the apex domain's nameservers are correctly set.

Exceeding subdomain length for preview URLs

Each DNS label has a [63-character limit](/kb/guide/why-is-my-vercel-deployment-url-being-shortened#rfc-1035). If you have a very long branch name plus a tenant subdomain, the fully generated preview URL might fail to resolve. Keep branch names concise.

Duplicate content SEO issues

If the same site is served from both subdomain and custom domain, consider using [canonical](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#alternates) tags or auto-redirecting to the primary domain.

Misspelled domain

A small typo can block domain verification or routing, so double-check your domain spelling.


Ahora necesito obtener más detalles sobre los archivos clave del repositorio para completar la documentación:````markdown name=multi-tenant. instructions. md
---
applyTo: "**/*. ts,**/*.tsx,**/*.js,**/*.jsx"
---

# Multi-Tenant Architecture Instructions for Next.js

This document defines the architectural patterns, conventions, and implementation rules for building multi-tenant applications in Next.js, based on the reference implementation at `vercel/platforms`.

## 1. Architecture Overview

### 1.1 Multi-Tenant Model

This architecture implements a subdomain-based multi-tenant system where:

- Each tenant is identified by a unique subdomain (`{tenant}. yourdomain.com`)
- The root domain hosts the main application (landing page, admin interface)
- Tenant data is stored in Redis using a namespaced key pattern
- Routing is handled at the Edge via Next.js middleware

### 1.2 Directory Structure

```
/
├── app/
│   ├── page.tsx              # Root domain landing page
│   ├── layout.tsx            # Global layout
│   ├── actions.ts            # Server Actions for tenant CRUD
│   ├── subdomain-form.tsx    # Tenant creation form component
│   ├── admin/
│   │   ├── page.tsx          # Admin dashboard
│   │   └── dashboard.tsx     # Admin UI component
│   └── s/
│       └── [subdomain]/
│           └── page.tsx      # Tenant-specific page (rewrite target)
├── lib/
│   ├── redis.ts              # Redis client configuration
│   ├── subdomains.ts         # Tenant data access layer
│   └── utils. ts              # Shared utilities and constants
├── middleware.ts             # Subdomain detection and routing
└── components/               # Shared UI components
```

## 2.  Middleware Implementation

### 2.1 Core Middleware Logic

The middleware file MUST be placed at the project root (`middleware.ts`).  Its responsibilities are:

1. Extract subdomain from incoming requests
2. Rewrite subdomain requests to the internal tenant route
3. Block restricted routes from subdomain access
4. Allow normal routing on the root domain

### 2.2 Subdomain Extraction Rules

```typescript
// REQUIRED: Import configuration
import { type NextRequest, NextResponse } from 'next/server';
import { rootDomain } from '@/lib/utils';
```

Subdomain extraction MUST handle three environments:

#### Local Development
```typescript
// Match pattern: http://{subdomain}.localhost:3000
if (url.includes('localhost') || url.includes('127.0. 0.1')) {
  const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
  if (fullUrlMatch && fullUrlMatch[1]) {
    return fullUrlMatch[1];
  }
  if (hostname.includes('.localhost')) {
    return hostname.split('.')[0];
  }
  return null;
}
```

#### Vercel Preview Deployments
```typescript
// Match pattern: {tenant}---{branch-name}.vercel.app
if (hostname.includes('---') && hostname.endsWith('.vercel. app')) {
  const parts = hostname.split('---');
  return parts.length > 0 ? parts[0] : null;
}
```

#### Production
```typescript
// Match pattern: {subdomain}.yourdomain.com
const isSubdomain =
  hostname !== rootDomainFormatted &&
  hostname !== `www.${rootDomainFormatted}` &&
  hostname.endsWith(`.${rootDomainFormatted}`);

return isSubdomain ? hostname. replace(`.${rootDomainFormatted}`, '') : null;
```

### 2. 3 Request Handling Rules

```typescript
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomain(request);

  if (subdomain) {
    // RULE: Block admin access from subdomains
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // RULE: Rewrite root path to tenant page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
    }
  }

  // RULE: Root domain uses standard routing
  return NextResponse.next();
}
```

### 2.4 Middleware Matcher Configuration

```typescript
export const config = {
  matcher: [
    // Exclude: /api routes, /_next internals, static files
    '/((?!api|_next|[\\w-]+\\.\\w+).*)'
  ]
};
```

## 3. Tenant Data Layer

### 3.1 Redis Key Pattern

All tenant data MUST use the following key pattern:

```
subdomain:{tenant-name}
```

Example: `subdomain:acme` for tenant "acme"

### 3.2 Redis Client Configuration

```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process. env.KV_REST_API_TOKEN
});
```

### 3.3 Tenant Data Schema

```typescript
type SubdomainData = {
  emoji: string;      // Tenant branding identifier
  createdAt: number;  // Unix timestamp
};
```

### 3.4 Data Access Functions

#### Retrieve Single Tenant
```typescript
export async function getSubdomainData(subdomain: string) {
  // RULE: Always sanitize subdomain input
  const sanitizedSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const data = await redis.get<SubdomainData>(`subdomain:${sanitizedSubdomain}`);
  return data;
}
```

#### Retrieve All Tenants
```typescript
export async function getAllSubdomains() {
  const keys = await redis.keys('subdomain:*');
  
  if (! keys.length) {
    return [];
  }

  const values = await redis.mget<SubdomainData[]>(...keys);

  return keys.map((key, index) => {
    const subdomain = key.replace('subdomain:', '');
    const data = values[index];
    return {
      subdomain,
      emoji: data?.emoji || '? ',
      createdAt: data?.createdAt || Date.now()
    };
  });
}
```

## 4. Server Actions

### 4.1 Tenant Creation

```typescript
'use server';

import { redis } from '@/lib/redis';
import { redirect } from 'next/navigation';
import { rootDomain, protocol } from '@/lib/utils';

export async function createSubdomainAction(prevState: any, formData: FormData) {
  const subdomain = formData.get('subdomain') as string;
  const icon = formData.get('icon') as string;

  // RULE: Validate required fields
  if (!subdomain || !icon) {
    return { success: false, error: 'Subdomain and icon are required' };
  }

  // RULE: Sanitize subdomain - only lowercase alphanumeric and hyphens
  const sanitizedSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');

  // RULE: Reject if sanitization modified the input
  if (sanitizedSubdomain !== subdomain) {
    return {
      subdomain,
      icon,
      success: false,
      error: 'Subdomain can only have lowercase letters, numbers, and hyphens.'
    };
  }

  // RULE: Check for existing tenant
  const subdomainAlreadyExists = await redis.get(`subdomain:${sanitizedSubdomain}`);
  if (subdomainAlreadyExists) {
    return {
      subdomain,
      icon,
      success: false,
      error: 'This subdomain is already taken'
    };
  }

  // RULE: Store tenant data
  await redis.set(`subdomain:${sanitizedSubdomain}`, {
    emoji: icon,
    createdAt: Date.now()
  });

  // RULE: Redirect to new tenant subdomain
  redirect(`${protocol}://${sanitizedSubdomain}.${rootDomain}`);
}
```

### 4.2 Tenant Deletion

```typescript
export async function deleteSubdomainAction(prevState: any, formData: FormData) {
  const subdomain = formData.get('subdomain') as string;
  
  if (!subdomain) {
    return { error: 'Subdomain is required' };
  }

  await redis.del(`subdomain:${subdomain}`);
  revalidatePath('/admin');
  
  return { success: `Subdomain "${subdomain}" has been deleted` };
}
```

## 5. Routing Architecture

### 5.1 App Router Structure

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Landing page / Tenant creation | Root domain only |
| `/admin` | Tenant management dashboard | Root domain only |
| `/s/[subdomain]` | Tenant-specific content | Internal (rewrite target) |

### 5.2 Tenant Page Implementation

```typescript
// app/s/[subdomain]/page.tsx
import { getSubdomainData } from '@/lib/subdomains';
import { notFound } from 'next/navigation';

export default async function SubdomainPage({
  params
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const data = await getSubdomainData(subdomain);

  // RULE: Return 404 for non-existent tenants
  if (!data) {
    notFound();
  }

  return (
    // Tenant-specific UI
  );
}
```

### 5.3 Dynamic Metadata

```typescript
export async function generateMetadata({
  params
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const data = await getSubdomainData(subdomain);

  if (!data) {
    return { title: 'Not Found' };
  }

  return {
    title: `${data.emoji} ${subdomain}`,
    description: `Welcome to ${subdomain}`
  };
}
```

## 6. Configuration Constants

### 6.1 Environment-Aware Settings

```typescript
// lib/utils.ts
export const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
export const rootDomain = process. env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
```

### 6.2 Required Environment Variables

```
KV_REST_API_URL=<upstash-redis-url>
KV_REST_API_TOKEN=<upstash-redis-token>
NEXT_PUBLIC_ROOT_DOMAIN=<your-production-domain>
```

## 7. Validation Rules

### 7.1 Subdomain Validation

- MUST be lowercase
- MUST contain only alphanumeric characters and hyphens
- MUST be unique across all tenants
- MUST NOT be empty

```typescript
const sanitizedSubdomain = subdomain. toLowerCase().replace(/[^a-z0-9-]/g, '');
```

### 7.2 Input Sanitization

All user input for subdomain names MUST be sanitized before:
- Storage in database
- URL construction
- Display in UI

## 8. Security Considerations

### 8.1 Route Protection

- Admin routes MUST be blocked from subdomain access
- Implement authentication for admin routes (marked as TODO in reference)
- Validate tenant ownership before mutations

### 8.2 Data Isolation

- Each tenant's data MUST be namespaced by subdomain key
- Cross-tenant data access MUST be prevented
- Use server-side validation for all tenant operations

## 9. URL Construction

### 9.1 Tenant URL Format

```typescript
const tenantUrl = `${protocol}://${subdomain}.${rootDomain}`;
```

### 9.2 Internal Rewrite Path

```typescript
const internalPath = `/s/${subdomain}`;
```

## 10. Development Workflow

### 10.1 Local Testing

Access patterns for local development:
- Root domain: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Tenant: `http://{tenant-name}.localhost:3000`

### 10.2 Vercel Preview Deployments

Tenant access pattern: `{tenant}---{branch-name}.vercel.app`

## 11. Implementation Checklist

When implementing multi-tenant features:

1. Place middleware at project root
2.  Implement subdomain extraction for all environments
3. Use namespaced Redis keys for tenant data
4. Sanitize all subdomain inputs
5. Block admin routes from subdomain access
6. Use Server Actions for tenant mutations
7. Implement proper error handling and validation
8. Generate dynamic metadata per tenant
9. Handle 404 for non-existent tenants
10. Use environment-aware protocol and domain constants
