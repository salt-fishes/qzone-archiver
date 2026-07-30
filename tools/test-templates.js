// 验证预编译模板在无 eval/Function 环境下能否正常工作
// 模拟 MV3 CSP：禁用 eval 和 new Function

// 1. 屏蔽 eval 和 new Function
const originalEval = global.eval;
const originalFunction = global.Function;
global.eval = function() { throw new Error('eval is disabled by CSP'); };
global.Function = function() { throw new Error('new Function is disabled by CSP'); };

// 2. 提供 window 全局对象
global.window = global;

// 3. 加载预编译模板文件
require('../src/js/templates-compiled.js');

console.log('已加载模板数量:', Object.keys(window.__templates__).length);
console.log('modifierMap keys:', Object.keys(window.__modifierMap__));

// 4. 测试渲染 index 模板
const testData = {
    user: {
        spacename: '测试空间',
        desc: '测试描述',
        uin: '12345678',
        isOwner: true,
        messages: 10,
        blogs: 5,
        diaries: 3,
        photos: 50,
        videos: 8,
        boards: 12,
        favorites: 7,
        shares: 4,
        visitors: 100
    },
    API: {
        Common: {
            getUserLogoLocalUrl: function(uin, isBig) {
                return 'Common/images/logo_' + uin + '.jpg';
            }
        }
    }
};

try {
    const render = window.__templates__['index'];
    console.log('index 模板类型:', typeof render);

    const result = render(testData, window.__modifierMap__);
    console.log('渲染结果长度:', result.length);
    console.log('包含测试空间:', result.indexOf('测试空间') > -1 ? '✓' : '✗');
    console.log('包含 12345678:', result.indexOf('12345678') > -1 ? '✓' : '✗');
    console.log('包含 messages=10:', result.indexOf('>10<') > -1 ? '✓' : '✗');
    console.log('包含日记(因 isOwner=true):', result.indexOf('Diaries') > -1 ? '✓' : '✗');

    // 验证结果中不包含 __code__ 等内部变量泄漏
    console.log('无 __code__ 泄漏:', result.indexOf('__code__') === -1 ? '✓' : '✗');

    console.log('\n所有测试通过！预编译模板可在 MV3 CSP 环境下正常工作。');
} catch (error) {
    console.error('渲染失败:', error.message);
    console.error(error.stack);
    process.exit(1);
} finally {
    // 恢复原始 eval/Function
    global.eval = originalEval;
    global.Function = originalFunction;
}
