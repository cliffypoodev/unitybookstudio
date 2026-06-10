/**
 * Custom Node.js ESM loader hook to resolve '@/lib/' imports
 * to the project's src/lib/ directory.
 * 
 * Usage: node --loader ./tests/loader.mjs tests/yourtest.test.mjs
 */
import { resolve as resolvePath, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolvePath(__dirname, '..');

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/lib/')) {
    // Map @/lib/foo → ./src/lib/foo.js
    let mapped = specifier.replace('@/lib/', '');
    if (!mapped.endsWith('.js')) mapped += '.js';
    const fullPath = join(projectRoot, 'src', 'lib', mapped);
    return { url: pathToFileURL(fullPath).href, shortCircuit: true };
  }

  // Handle relative imports that might use bare '@' prefix
  if (specifier.startsWith('@/')) {
    let mapped = specifier.replace('@/', '');
    if (!mapped.endsWith('.js')) mapped += '.js';
    const fullPath = join(projectRoot, 'src', mapped);
    return { url: pathToFileURL(fullPath).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
