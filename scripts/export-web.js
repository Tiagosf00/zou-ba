const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const packageJson = require('../package.json');

const projectRoot = path.resolve(__dirname, '..');
const exportTarget = process.argv[2] === 'github' ? 'docs' : 'dist';
const defaultBaseUrl = process.argv[2] === 'github' ? `/${packageJson.name}` : '';
const baseUrl = process.env.EXPO_BASE_URL ?? defaultBaseUrl;

const cliPath = require.resolve('expo/bin/cli', { paths: [projectRoot] });
const result = spawnSync(
    process.execPath,
    [cliPath, 'export', '--platform', 'web', '--output-dir', exportTarget],
    {
        cwd: projectRoot,
        env: {
            ...process.env,
            ...(baseUrl ? { EXPO_BASE_URL: baseUrl } : {}),
        },
        stdio: 'inherit',
    },
);

if (result.error) {
    throw result.error;
}

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

if (process.argv[2] === 'github') {
    fs.writeFileSync(path.join(projectRoot, exportTarget, '.nojekyll'), '');
}
