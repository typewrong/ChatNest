import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

// 自定义插件，用于复制资源文件到dist目录
const copyAssetsPlugin = () => {
  return {
    name: 'copy-assets',
    closeBundle() {
      // 确保目标目录存在
      const ensureDir = (dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      };

      // 复制文件
      const copyFile = (src, dest) => {
        try {
          fs.copyFileSync(src, dest);
          console.log(`Copied: ${src} -> ${dest}`);
        } catch (err) {
          console.error(`Error copying ${src} to ${dest}:`, err);
        }
      };

      // 复制目录
      const copyDir = (src, dest) => {
        ensureDir(dest);
        const files = fs.readdirSync(src);
        
        files.forEach(file => {
          const srcPath = path.join(src, file);
          const destPath = path.join(dest, file);
          
          if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            copyFile(srcPath, destPath);
          }
        });
      };

      // 创建目录
      ensureDir('dist/icons');
      ensureDir('dist/popup');
      ensureDir('dist/tests');
      ensureDir('dist/js/tests');
      ensureDir('dist/libs');

      // 复制图标
      copyFile('src/icons/icon16.png', 'dist/icons/icon16.png');
      copyFile('src/icons/icon48.png', 'dist/icons/icon48.png');
      copyFile('src/icons/icon128.png', 'dist/icons/icon128.png');

      // 复制JSZip库
      copyFile('src/libs/jszip.min.js', 'dist/libs/jszip.min.js');

      // 复制HTML文件
      copyFile('src/popup/index.html', 'dist/popup/index.html');
      copyFile('src/popup/export.html', 'dist/popup/export.html');
      
      // 复制CSS文件
      copyFile('src/popup/styles.css', 'dist/popup/styles.css');
      
      // 复制测试文件
      ensureDir('dist/tests');
      copyFile('src/tests/tests.html', 'dist/tests/tests.html');
      copyFile('src/tests/e2e.html', 'dist/tests/e2e.html');
      copyFile('src/tests/compatibility.html', 'dist/tests/compatibility.html');
      
      // 直接复制测试JS文件而非通过打包
      copyFile('src/tests/functionality.test.js', 'dist/tests/functionality.test.js');
      copyFile('src/tests/e2e.test.js', 'dist/tests/e2e.test.js');
      copyFile('src/tests/compatibility.test.js', 'dist/tests/compatibility.test.js');

      // 复制manifest.json
      copyFile('src/manifest.json', 'dist/manifest.json');
    }
  };
};

export default defineConfig({
  plugins: [react(), copyAssetsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.js'),
        content: resolve(__dirname, 'src/content/main.js'),
        deepseek: resolve(__dirname, 'src/content/deepseek.js'),
        doubao: resolve(__dirname, 'src/content/doubao.js'),
        popup: resolve(__dirname, 'src/popup/popup.js'),
        export: resolve(__dirname, 'src/popup/export.js')
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
}); 