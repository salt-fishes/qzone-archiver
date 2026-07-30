/**
 * 模板预编译脚本
 *
 * 用途：将 src/templates/*.html 模板文件预编译为 JS 函数，
 *       输出到 src/js/templates-compiled.js，避免运行时调用 new Function 和 eval
 *       （两者都被 MV3 CSP 禁止）
 *
 * 原理：
 *   template.js 通过 new Function + eval 编译并执行模板：
 *     1. new Function("__data__","__modifierMap__", body)  — 被 CSP 禁止
 *     2. 函数内部 eval(__str__) 解包 data 的 key 为局部变量 — 被 CSP 禁止
 *
 *   本脚本在 Node 环境调用 template.js 编译模板，提取编译后的代码字符串（render.toString()），
 *   然后用 with(__data__) 语句替代 eval 解包，并包装为普通函数声明。
 *   运行时直接调用预编译函数，无需 new Function 或 eval。
 *
 * 使用方法：
 *   node tools/precompile-templates.js
 *
 * 修改模板后需重新运行此脚本。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'templates');
const OUTPUT_FILE = path.join(ROOT, 'src', 'js', 'templates-compiled.js');

// 加载 vendor/template/template.js（UMD 模块，在 Node 中通过 require 加载）
const template = require(path.join(ROOT, 'src', 'vendor', 'template', 'template.js'));

if (typeof template !== 'function') {
    console.error('加载 template.js 失败：未找到 template 函数');
    process.exit(1);
}

console.info('开始预编译模板...');
console.info('模板目录：', TEMPLATES_DIR);
console.info('输出文件：', OUTPUT_FILE);

const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.html'));
console.info('发现模板文件：', files.length, '个');

const compiled = {};
for (const file of files) {
    const name = path.basename(file, '.html');
    const filePath = path.join(TEMPLATES_DIR, file);
    const tplContent = fs.readFileSync(filePath, 'utf8');

    try {
        // template(tplString) 返回 render 函数
        // render.toString() 被 template.js 重写为返回编译后的代码字符串 e
        //   （即 ";__code__ += (...)\n;__code__ += (expr)\n..." 形式）
        const render = template(tplContent);
        const compiledCode = render.toString();

        if (!compiledCode || compiledCode.indexOf('__code__') === -1) {
            throw new Error('编译后的代码不含 __code__，可能 template.js 行为变化');
        }

        compiled[name] = compiledCode;
        console.info('  ✓ ' + name + ' (' + compiledCode.length + ' bytes)');
    } catch (error) {
        console.error('  ✗ ' + name + ' 编译失败：', error.message);
        process.exit(1);
    }
}

// 生成输出文件
// 关键改造点：
//   1. 用 with(__data__) 替代 template.js 原本的 eval(__str__) 解包数据
//   2. 用普通函数声明替代 new Function，避免触发 CSP
//   3. modifierMap 从 template.js 提取并内联，避免运行时依赖 template.js
const output = `/**
 * 预编译模板文件（自动生成，请勿手动修改）
 *
 * 由 tools/precompile-templates.js 生成
 * 修改 src/templates/*.html 后需重新运行：node tools/precompile-templates.js
 *
 * 该文件替代运行时 template.js 编译，避免 MV3 CSP 禁止 unsafe-eval / new Function 的问题
 * 原理：在 Node 环境预编译模板，提取编译后的代码字符串，用 with(__data__) 替代 eval 解包
 */

// 修饰符映射（从 template.js 提取，保持运行时兼容）
// 注意：挂到 window 上，避免 var 声明在模块作用域中无法被模板函数访问
window.__modifierMap__ = {
    "": function(s) { return s; },
    "h": function(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\\\\/g, "&#92;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    "u": function(s) { return encodeURI(s); }
};

// 预编译模板函数集合
// 每个函数签名: function(__data__, __modifierMap__) -> string
// 注意：函数内使用 with(__data__) 语句，因此不启用严格模式
window.__templates__ = window.__templates__ || {};
${Object.entries(compiled).map(([name, code]) => {
    // 用 with 替代 eval，包装为函数声明
    // 注意：with 语句在严格模式下不可用，因此函数体不声明 'use strict'
    return `window.__templates__['${name}'] = function(__data__, __modifierMap__) {
    __modifierMap__ = __modifierMap__ || window.__modifierMap__ || {};
    var __code__ = "";
    with (__data__ || {}) {
${code}
    }
    return __code__;
};`;
}).join('\n\n')}
`;

fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
console.info('');
console.info('预编译完成，输出到：', OUTPUT_FILE);
console.info('共编译模板：', Object.keys(compiled).length, '个');
console.info('');
console.info('后续步骤：');
console.info('  1. manifest.json content_scripts 中添加 src/js/templates-compiled.js');
console.info('  2. content_scripts 中可移除 vendor/template/template.js（导出页仍需保留）');
console.info('  3. API.Common.getHtmlTemplate 已改为调用 window.__templates__[name]');
