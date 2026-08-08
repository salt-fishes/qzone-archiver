/**
 * 仓库层：持久化（P3）
 * 写文件函数逐字迁自 modules/common.js（行为零变化）：
 * 纯持久化逻辑集中于此，模块层 API.Common 单行委托本层。
 * 说明：P3 阶段该函数仍引用 API.Utils 全局（委托后仍可解析）。
 */
window.QZoneRepo = window.QZoneRepo || {};

QZoneRepo.writer = QZoneRepo.writer || {};

/**
 * 基于JSON生成JS文件
 * @param {string} key js变量名
 * @param {object} object 对象
 * @param {string} path js文件路径
 */
QZoneRepo.writer.writeJsonToJs = async(key, object, path) => {
    const json = JSON.stringify(object);
    const js = 'window.' + key + ' = ' + json;
    return await API.Utils.writeText(js, path);
}
