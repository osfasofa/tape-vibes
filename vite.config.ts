import { defineConfig, type Plugin } from 'vite';
import { transform } from 'esbuild';

// Plugin to compile AudioWorklet .ts files to JS using esbuild
function audioWorkletPlugin(): Plugin {
  return {
    name: 'audio-worklet',
    apply: 'build',
    async generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.ts') && asset.type === 'asset') {
          const source = typeof asset.source === 'string'
            ? asset.source
            : new TextDecoder().decode(asset.source);

          // Compile TS → JS using esbuild
          const result = await transform(source, {
            loader: 'ts',
            target: 'esnext',
          });

          const jsName = fileName.replace(/\.ts$/, '.js');
          delete bundle[fileName];
          this.emitFile({
            type: 'asset',
            fileName: jsName,
            source: result.code,
          });

          // Update references in other chunks/assets
          for (const otherAsset of Object.values(bundle)) {
            if (otherAsset.type === 'chunk' && otherAsset.code.includes(fileName)) {
              otherAsset.code = otherAsset.code.replaceAll(fileName, jsName);
            }
            if (otherAsset.type === 'asset' && typeof otherAsset.source === 'string' && otherAsset.source.includes(fileName)) {
              otherAsset.source = otherAsset.source.replaceAll(fileName, jsName);
            }
          }
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
  plugins: [audioWorkletPlugin()],
});
