// 下载 MV3 所需的本地 vendor 资源
// 用 Node 内置 https 模块，避免 PowerShell 与 curl 的兼容问题

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');

// 待下载资源列表
const resources = [
    // font-awesome 4.7.0
    { url: 'https://cdn.staticfile.org/font-awesome/4.7.0/css/font-awesome.min.css', path: 'src/vendor/font-awesome/css/font-awesome.min.css' },
    { url: 'https://cdn.staticfile.org/font-awesome/4.7.0/css/font-awesome.css', path: 'src/vendor/font-awesome/css/font-awesome.css' },
    // fontawesome-webfont.woff2 (CSS 引用)
    { url: 'https://cdn.staticfile.org/font-awesome/4.7.0/fonts/fontawesome-webfont.woff2', path: 'src/vendor/font-awesome/fonts/fontawesome-webfont.woff2' },
    { url: 'https://cdn.staticfile.org/font-awesome/4.7.0/fonts/fontawesome-webfont.woff', path: 'src/vendor/font-awesome/fonts/fontawesome-webfont.woff' },
    { url: 'https://cdn.staticfile.org/font-awesome/4.7.0/fonts/fontawesome-webfont.ttf', path: 'src/vendor/font-awesome/fonts/fontawesome-webfont.ttf' },
    { url: 'https://cdn.staticfile.org/font-awesome/4.7.0/fonts/FontAwesome.otf', path: 'src/vendor/font-awesome/fonts/FontAwesome.otf' },
    // popper 2.9.3 (bundle 版本已含 popper，但保留单独版本以备需要)
    { url: 'https://cdn.staticfile.org/popper.js/2.9.3/umd/popper.min.js', path: 'src/vendor/popper/umd/popper.min.js' },
    // moment 2.27.0
    { url: 'https://cdn.staticfile.org/moment.js/2.27.0/moment.min.js', path: 'src/vendor/moment/moment.min.js' },
    { url: 'https://cdn.staticfile.org/moment.js/2.27.0/locale/zh-cn.min.js', path: 'src/vendor/moment/zh-cn.min.js' },
    // tempusdominus-bootstrap-4 5.39.0
    { url: 'https://cdn.staticfile.org/tempusdominus-bootstrap-4/5.39.0/css/tempusdominus-bootstrap-4.min.css', path: 'src/vendor/tempusdominus/css/tempusdominus-bootstrap-4.min.css' },
    { url: 'https://cdn.staticfile.org/tempusdominus-bootstrap-4/5.39.0/js/tempusdominus-bootstrap-4.min.js', path: 'src/vendor/tempusdominus/js/tempusdominus-bootstrap-4.min.js' }
];

function download(url, filePath) {
    return new Promise((resolve, reject) => {
        const full = path.join(ROOT, filePath);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        const file = fs.createWriteStream(full);
        https.get(url, (resp) => {
            if (resp.statusCode === 301 || resp.statusCode === 302) {
                // 跟随重定向
                file.close();
                fs.unlinkSync(full);
                return download(resp.headers.location, filePath).then(resolve, reject);
            }
            if (resp.statusCode !== 200) {
                file.close();
                fs.unlinkSync(full);
                return reject(new Error(`HTTP ${resp.statusCode} for ${url}`));
            }
            resp.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            try { fs.unlinkSync(full); } catch (e) {}
            reject(err);
        });
    });
}

(async () => {
    console.log(`开始下载 ${resources.length} 个资源...`);
    let ok = 0, fail = 0;
    for (const r of resources) {
        try {
            await download(r.url, r.path);
            const stats = fs.statSync(path.join(ROOT, r.path));
            console.log(`  ✓ ${r.path} (${stats.size} bytes)`);
            ok++;
        } catch (err) {
            console.error(`  ✗ ${r.path}: ${err.message}`);
            fail++;
        }
    }
    console.log(`\n完成：成功 ${ok}，失败 ${fail}`);
    process.exit(fail > 0 ? 1 : 0);
})();
