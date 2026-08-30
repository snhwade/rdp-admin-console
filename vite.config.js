/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
// 单一前端工程构建配置
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        // CodeMirror 要求全应用仅一个 @codemirror/state 实例，否则编辑器扩展会在运行时
        // 抛 "Unrecognized extension value" 导致用到编辑器的页面（/rules、/indicators）白屏。
        // 部分传递依赖（如 @codemirror/commands）会嵌套安装自己的 state 副本，这里强制去重。
        dedupe: [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/language',
            '@codemirror/autocomplete',
            '@codemirror/lint',
            '@codemirror/commands',
        ],
    },
    server: {
        port: 5173,
        proxy: {
            // 指标定义：开发期若 admin-bff 未重启，BFF 无该路由会误返回 401；直连 rule-config
            '/bff/api/v1/indicator-definitions': {
                target: 'http://localhost:8082',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/bff/, ''); },
            },
            '/bff/api/v1/indicator-groups': {
                target: 'http://localhost:8082',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/bff/, ''); },
            },
            '/bff/api/v1/logical-indicators': {
                target: 'http://localhost:8082',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/bff/, ''); },
            },
            '/bff/api/v1/list-libraries': {
                target: 'http://localhost:8085',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/bff\/api\/v1/, '/api/v1'); },
            },
            '/bff/api/v1/list-dimensions': {
                target: 'http://localhost:8085',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/bff\/api\/v1/, '/api/v1'); },
            },
            '/bff/api/v1/list-attr-defs': {
                target: 'http://localhost:8085',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/bff\/api\/v1/, '/api/v1'); },
            },
            '/bff/api/v1/list-entries': {
                target: 'http://localhost:8085',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/bff\/api\/v1/, '/api/v1'); },
            },
            // 其余接口经 Admin BFF
            '/bff': 'http://localhost:8080',
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
    },
});
