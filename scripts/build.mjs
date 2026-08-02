import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'src', 'public'), path.join(dist, 'public'), { recursive: true });
await cp(path.join(root, 'src', 'server.js'), path.join(dist, 'server.js'));

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const runtimePackage = {
  name: packageJson.name,
  version: packageJson.version,
  private: true,
  type: 'module',
  engines: packageJson.engines,
};
await writeFile(path.join(dist, 'package.json'), `${JSON.stringify(runtimePackage, null, 2)}\n`);

console.log(`Built ${packageJson.name}@${packageJson.version} in dist/`);
