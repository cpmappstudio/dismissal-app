import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

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
