import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('brand references use the current SVG logo and both favicon formats', () => {
    const logo = readFileSync(new URL('../components/university-logo.tsx', import.meta.url), 'utf8');
    const layout = readFileSync(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8');
    assert.ok(logo.includes('isCollapsed ? "/favicon.svg" : "/oficial-logo.svg"'));
    assert.ok(logo.includes('alt="Dismissal"'));
    assert.doesNotMatch(logo, /oficial-logo.*\.png|Alef University/);
    for (const name of ['oficial-logo.svg', 'favicon.svg']) {
        assert.match(readFileSync(new URL('../public/' + name, import.meta.url), 'utf8'), /<svg\b/);
    }
    assert.ok(layout.includes('{ url: "/favicon.svg", type: "image/svg+xml", sizes: "any" }'));
    assert.ok(layout.includes('{ url: "/favicon.ico", type: "image/x-icon" }'));
    assert.ok(readFileSync(new URL('../public/favicon.ico', import.meta.url)).length > 0);
});

test('bus map credits reuse the sidebar green and omit the route disclaimer', () => {
    const hero = readFileSync(new URL('../components/dashboard/buses/bus-hero.tsx', import.meta.url), 'utf8');
    const waves = readFileSync(new URL('../components/brand-waves.tsx', import.meta.url), 'utf8');
    assert.match(waves, /fill="var\(--primary\)"/);
    assert.match(hero, /className="[^"]*\bbg-primary\b[^"]*\btext-primary-foreground\b[^"]*">\s*Tiles ©/);
    assert.doesNotMatch(hero, /mapApproximate/);
    assert.match(hero, /https:\/\/www\.openstreetmap\.org\/copyright/);
});

test('campus status badges use an opaque themed surface over campus images', () => {
    const badge = readFileSync(new URL('../components/dashboard/campus-settings/campus-settings-overview/campus-settings-status-badge.tsx', import.meta.url), 'utf8');
    assert.match(badge, /\bbg-card\b/);
    assert.doesNotMatch(badge, /bg-[\w-]+\/\d+/);
    assert.match(badge, /active: "text-success"/);
    assert.match(badge, /inactive: "text-muted-foreground"/);
    assert.match(badge, /maintenance: "text-amber-700 dark:text-amber-400"/);
});

test('compact Clerk card sizing is scoped to sign-in, not the account panel', () => {
    const layout = readFileSync(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const signIn = readFileSync(new URL('../app/[locale]/sign-in/[[...sign-in]]/page.tsx', import.meta.url), 'utf8');
    const globalCardClasses = layout.match(/cardBox:\s*"([^"]+)"/)?.[1];
    assert.ok(globalCardClasses);
    assert.doesNotMatch(globalCardClasses, /(?:^|\s)(?:max-w-|min-w-|w-)/);
    assert.match(signIn, /<SignIn\s+appearance=/);
    assert.match(signIn, /cardBox:\s*"w-full max-w-sm"/);
});

test('sign-in bleeds the bus past the page edge and layers the child between solid brand shapes', () => {
    const page = readFileSync(new URL('../app/[locale]/sign-in/[[...sign-in]]/page.tsx', import.meta.url), 'utf8');
    assert.ok(page.includes('src="/oficial-logo.svg"'));
    assert.ok(page.includes('<BrandWaves variant="sign-in"'));
    assert.ok(page.includes('grid-cols-1'));
    assert.ok(page.includes('lg:grid-cols-[1.15fr_1fr]'));
    assert.match(page, /bottom-0 -right-\[8%\] hidden h-\[95%\] w-\[90%\] lg:block/);
    assert.ok(page.includes('src="/bg-bus.png"'));
    assert.ok(page.includes('sizes="(min-width: 1024px) 90vw, 1px"'));
    assert.ok(page.includes('object-contain object-right-bottom'));
    assert.ok(readFileSync(new URL('../public/bg-bus.png', import.meta.url)).length > 0);
    assert.doesNotMatch(page, /bg-bus\.webp|object-cover|<svg/);
    assert.ok(page.includes('src="/kid.webp"'));
    assert.match(page, /z-\[2\] hidden h-\[58%\] w-\[34%\] lg:block/);
    assert.ok(readFileSync(new URL('../public/kid.webp', import.meta.url)).length > 0);
    assert.ok(page.includes('lg:self-center'));
    assert.doesNotMatch(page, /gradient|lg:self-start|lg:mt-4/);
    const waves = readFileSync(new URL('../components/brand-waves.tsx', import.meta.url), 'utf8');
    const foreground = waves.split('{variant === "sign-in" ? <>')[1].split('</> : <>')[0];
    assert.doesNotMatch(foreground, /opacity|gradient/i);
    assert.ok(page.includes('getTranslations("signInPage")'));
    for (const locale of ['en', 'es']) {
        const messages = JSON.parse(readFileSync(new URL('../messages/' + locale + '.json', import.meta.url), 'utf8'));
        for (const key of ['headline', 'headlineEnd', 'description']) assert.ok(messages.signInPage[key]);
    }
});

function luminance(hex: string) {
    const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => {
        const channel = parseInt(value, 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const selector of [':root', '.dark']) {
    test(`${selector} theme text meets WCAG AA contrast for normal text`, () => {
        const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
        const colors = Object.fromEntries([...block.matchAll(/--([\w-]+): (#[a-f\d]{6});/gi)].map(([, name, hex]) => [name, hex]));
        const pairs = [
            ['foreground', 'background'], ['card-foreground', 'card'],
            ['popover-foreground', 'popover'], ['primary-foreground', 'primary'],
            ['secondary-foreground', 'secondary'], ['accent-foreground', 'accent'],
            ['muted-foreground', 'background'], ['muted-foreground', 'card'],
            ['muted-foreground', 'muted'], ['sidebar-foreground', 'sidebar'],
            ['success', 'card'],
            ['sidebar-accent-foreground', 'sidebar-accent'],
            ...['success', 'destructive', 'info'].flatMap(status => [
                [`${status}-foreground`, status], [status, `${status}-soft`],
            ]),
        ];
        for (const [foreground, background] of pairs) {
            assert.ok(colors[foreground] && colors[background], `Missing ${foreground}/${background}`);
            const values = [luminance(colors[foreground]), luminance(colors[background])].sort((a, b) => b - a);
            const ratio = (values[0] + 0.05) / (values[1] + 0.05);
            assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}:1, expected at least 4.5:1`);
        }
    });
}
