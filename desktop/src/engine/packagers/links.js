/**
 * 打包层：链接/清单（P5）
 * 写文件函数逐字迁自 modules/common.js（行为零变化），模块侧委托本层。
 */
window.QZonePackagers = window.QZonePackagers || {};

QZonePackagers.Links = {
  /**
   * 写入迅雷任务到文件
   * @param {ThunderInfo} thunderInfo 迅雷下载信息
   */
  writeThunderTaskToFile: async(thunderInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Thunder_Link');
    indicator.print();

    // 处理迅雷下载信息
    const _thunderInfo = QZonePackagers.Links.handerThunderInfo(thunderInfo);

    // 分批
    const tasks = _thunderInfo.tasks || [];
    const _tasks = _.chunk(tasks, QZone_Config.Common.thunderTaskNum);
    for (let i = 0; i < _tasks.length; i++) {
        const index = i + 1;
        await indicator.setIndex(index);

        const list = _tasks[i];
        let taskGroupName = _thunderInfo.taskGroupName;
        if (_tasks.length > 1) {
            taskGroupName = taskGroupName + "_" + index;
        }

        // 唤起迅雷下载
        const groupTask = new ThunderInfo(taskGroupName, QZone_Config.Common.downloadThread, list)

        // 写入文件
        const json = 'thunderx://' + JSON.stringify(groupTask);
        await API.Utils.writeText(json, API.Common.getRootFolder() + '/' + taskGroupName + '_迅雷下载链接.txt').then((fileEntry) => {
            console.info("导出迅雷下载链接完成", fileEntry);
        }).catch((error) => {
            console.error("导出迅雷下载链接异常", error);
        })

    }

    // 完成
    indicator.complete();
  },

  /**
   * 处理迅雷下载信息
   * @param {ThunderInfo} thunderInfo 迅雷下载信息
   */
  handerThunderInfo: (thunderInfo) => {
    // 简单克隆
    const _thunderInfo = JSON.parse(JSON.stringify(thunderInfo));

    // 移除多余属性
    const _tasks = _thunderInfo.tasks;
    for (const _temp of _tasks) {
        delete _temp.downloadState;
        delete _temp.source;
        delete _temp.module;
    }

    return _thunderInfo;
  },
};
