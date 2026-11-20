import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const threeUrl = pathToFileURL('/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/vendor/three/build/three.module.js').href;

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: ${JSON.stringify(threeUrl)}, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`));
