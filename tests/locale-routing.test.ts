import assert from 'node:assert/strict';
import test from 'node:test';
import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { routing } from '../i18n/routing';

const middleware = createMiddleware(routing);

for (const path of ['/', '/sign-in', '/management/students', '/bus']) {
    test(`${path} defaults to English despite Spanish browser and cookie preferences`, () => {
        const response = middleware(new NextRequest(`https://example.com${path}`, {
            headers: { 'accept-language': 'es-ES,es;q=0.9', cookie: 'NEXT_LOCALE=es' },
        }));
        assert.equal(response.status, 307);
        assert.equal(response.headers.get('location'), `https://example.com/en${path === '/' ? '' : path}`);
    });
}

for (const locale of routing.locales) {
    test(`an explicit ${locale} URL keeps its selected language`, () => {
        const url = `https://example.com/${locale}/sign-in`;
        const response = middleware(new NextRequest(url, {
            headers: { 'accept-language': 'es', cookie: 'NEXT_LOCALE=es' },
        }));
        assert.equal(response.headers.get('location'), null);
        assert.equal(response.headers.get('x-middleware-rewrite'), url);
    });
}
