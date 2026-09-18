import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['en', 'es'],

    // Used when no locale matches
    defaultLocale: 'en',

    // Use English unless the URL explicitly selects another locale.
    localeDetection: false
});
