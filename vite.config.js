import { defineConfig } from 'vite';

export default defineConfig({
    // 关键：设置为相对路径 './'，这样无论你把它放在域名的根目录还是子目录，都能找到资源
    base: './',
    build: {
        outDir: 'dist', // 打包输出目录
        assetsDir: 'assets', // 资源目录
    }
});