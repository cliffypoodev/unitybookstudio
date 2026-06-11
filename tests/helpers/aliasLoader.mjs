/**
 * aliasLoader.mjs — Node ESM loader hook that resolves Vite's `@/` alias.
 *
 * Usage:
 *   node --loader ./tests/helpers/aliasLoader.mjs tests/myTest.mjs
 *
 * Resolves `@/lib/foo.js` → `<projectRoot>/src/lib/foo.js`
 *          `@/api/bar`    → `<projectRoot>/src/api/bar.js`  (auto-append .js)
 *
 * This mirrors vite.config.js: { resolve: { alias: { '@': './src' } } }
 */
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const srcDir = path.join(projectRoot, 'src');

/**
 * resolve hook — intercept `@/` specifiers and rewrite them to absolute
 * file:// URLs pointing into ./src/.
 *
 * Vite doesn't require .js extensions on imports; Node ESM does.
 * We auto-append .js if the specifier doesn't already have an extension
 * and the .js file exists on disk.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const relativePath = specifier.slice(2); // strip '@/'
    let absolutePath = path.join(srcDir, relativePath);

    // Auto-append .js if no extension and .js file exists
    if (!path.extname(absolutePath)) {
      const withJs = absolutePath + '.js';
      const withMjs = absolutePath + '.mjs';
      if (fs.existsSync(withJs)) {
        absolutePath = withJs;
      } else if (fs.existsSync(withMjs)) {
        absolutePath = withMjs;
      }
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(absolutePath).href,
    };
  }
  return nextResolve(specifier, context);
}
