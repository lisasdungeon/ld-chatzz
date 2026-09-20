import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath) {
    const filePath = path.join(root, relativePath);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function fileExists(relativePath) {
    return fs.existsSync(path.join(root, relativePath));
}

try {
    const moduleJson = readJson('module.json');
    const packageJson = readJson('package.json');

    assert(moduleJson.id === packageJson.name, 'module.json id must match package.json name.');
    assert(moduleJson.version === packageJson.version, 'module.json and package.json versions must match.');
    assert(moduleJson.compatibility?.minimum >= 11, 'module.json compatibility.minimum must be 11 or higher.');
    assert(moduleJson.compatibility?.verified === 13, 'module.json compatibility.verified must be 13.');
    assert(Array.isArray(moduleJson.esmodules) && moduleJson.esmodules.length > 0, 'module.json must declare at least one esmodule entry.');
    assert(Array.isArray(moduleJson.styles) && moduleJson.styles.length > 0, 'module.json must declare at least one stylesheet.');
    assert(Array.isArray(moduleJson.languages) && moduleJson.languages.length > 0, 'module.json must declare at least one language file.');

    const requiredFiles = [
        'main.js',
        'README.md',
        'CHANGELOG.md',
        'LICENSE',
        'lang/en.json',
        'templates/chat-window.hbs',
        'templates/group-manager.hbs',
        'src/LDChatzz.js',
        'src/SocketHandler.js',
        'styles/chatzz-base.css'
    ];

    for (const relativePath of requiredFiles) {
        assert(fileExists(relativePath), `Missing required file: ${relativePath}`);
    }

    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    assert(
        readme.includes('https://github.com/lisasdungeon/ld-chatzz/releases/latest/download/module.json'),
        'README.md must reference the latest release manifest URL.'
    );
    assert(readme.includes(moduleJson.version), 'README.md must mention the current version.');
    assert(moduleJson.authors?.[0]?.name === "Lisa's Dungeon", "Author must be Lisa's Dungeon.");
    assert(moduleJson.authors?.[0]?.discord === 'MystryssLysa', 'Discord must be MystryssLysa.');
    assert(moduleJson.authors?.[0]?.email === 'Lisasdungeon@gmail.com', 'Email must be Lisasdungeon@gmail.com.');

    console.log('Validation passed for LD Chatzz.');
} catch (error) {
    console.error(`Validation failed: ${error.message}`);
    process.exitCode = 1;
}