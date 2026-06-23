import { spawnSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import path from 'path';

const root = process.cwd();
const ignoredDirs = new Set(['node_modules', '.git', '.agents']);

function collectJsFiles(dir) {
    const entries = readdirSync(dir);
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            if (!ignoredDirs.has(entry)) {
                files.push(...collectJsFiles(fullPath));
            }
            continue;
        }

        if (entry.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

const jsFiles = collectJsFiles(root);
let failed = false;

for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ['--check', file], {
        stdio: 'inherit'
    });

    if (result.status !== 0) {
        failed = true;
    }
}

if (failed) {
    process.exit(1);
}

console.log(`Syntax check passed for ${jsFiles.length} JavaScript files.`);
