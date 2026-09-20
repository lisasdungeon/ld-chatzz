/**
 * LD Chatzz — Headless Mobile Overflow Audit
 *
 * Renders tools/mobile-audit.html at a set of phone widths in a headless
 * Firefox and reports any element that overflows the viewport horizontally.
 *
 * Usage:
 *   node scripts/audit-mobile.mjs [width ...]
 *   npm run audit:mobile [-- width ...]
 *
 * Defaults to 320 375 390 768. Set FIREFOX=/path/to/firefox to override the
 * browser binary. Exits non-zero if any viewport fails or produces no output.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pageUrl = 'file://' + path.join(root, 'tools', 'mobile-audit.html');

const args = process.argv.slice(2);
const widths = args.length ? args : ['320', '375', '390', '768'];
const firefox = process.env.FIREFOX || 'firefox';

/**
 * Run Firefox headless, capturing stdout to a file and polling for the
 * audit's RESULT line. Avoids waiting on a stdout pipe that a forked browser
 * child may keep open (which makes execFileSync hang on some distros).
 */
function runFirefox(firefoxArgs, timeoutMs = 30000) {
    return new Promise((resolve) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatzz-audit-'));
        const outFile = path.join(dir, 'stdout.txt');
        const outFd = fs.openSync(outFile, 'w');
        const child = spawn(firefox, firefoxArgs, { stdio: ['ignore', outFd, outFd] });

        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            clearInterval(interval);
            clearTimeout(timer);
            try { child.kill('SIGKILL'); } catch { /* already gone */ }
            try { fs.closeSync(outFd); } catch { /* already closed */ }
            let data = '';
            try { data = fs.readFileSync(outFile, 'utf8'); } catch { /* missing */ }
            fs.rmSync(dir, { recursive: true, force: true });
            resolve(data);
        };

        const interval = setInterval(() => {
            try {
                if (fs.readFileSync(outFile, 'utf8').includes('AUDIT RESULT=')) finish();
            } catch { /* file not ready yet */ }
        }, 250);

        const timer = setTimeout(finish, timeoutMs);
    });
}

const versionCheck = spawnSync(firefox, ['--version'], { stdio: 'ignore', timeout: 10000 });
if (versionCheck.error || versionCheck.status === null) {
    console.error(`[audit-mobile] Could not run "${firefox}". Install Firefox or set FIREFOX=/path/to/firefox.`);
    process.exit(2);
}

let failures = 0;

for (const width of widths) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'chatzz-ff-'));
    fs.writeFileSync(path.join(profile, 'user.js'), 'user_pref("browser.dom.window.dump.enabled", true);\n');

    const stdout = await runFirefox([
        '-headless',
        '--screenshot', path.join(profile, 'shot.png'),
        `--window-size=${width},700`,
        '-profile', profile,
        pageUrl
    ]);

    const lines = stdout
        .split('\n')
        .filter((line) => line.startsWith('AUDIT '))
        .map((line) => line.slice('AUDIT '.length));

    console.log(`== ${width} px ==`);
    if (!lines.length) {
        console.log('  (no AUDIT output captured)');
        failures++;
    } else {
        for (const line of lines) console.log('  ' + line);
        if (!lines.some((line) => line.startsWith('RESULT=PASS'))) failures++;
    }

    fs.rmSync(profile, { recursive: true, force: true });
}

if (failures) {
    console.error(`\n[audit-mobile] ${failures} viewport(s) failed or produced no result.`);
    process.exit(1);
}
console.log('\n[audit-mobile] all viewports pass.');
