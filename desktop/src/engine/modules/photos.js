/**
 * QQ空间相册模块的导出A
 * @author https://github.com/ShunCai/
 */


/**
 * 导出相册数据
 */
API.Photos.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Photos_Row_Infos');
    indicator.print();

    try {
        // 用户选择的备份相册列表
        const albumList = await API.Photos.initAlbums();

        // 获取相册的评论列表
        await API.Photos.getAllAlbumsComments(albumList);

        // 获取相册赞记录
        await API.Photos.getAlbumsLikeList(albumList);

        // 获取相册最近访问
        await API.Photos.getAllVisitorList(albumList);

        // 获取所有相册的相片列表
        const imagesMapping = await API.Photos.getAllAlbumImageListByListType(albumList);

        // 获取所有相片的详情
        await API.Photos.getAllImagesInfos(albumList);

        // 刷新相片的相册信息
        API.Photos.refreshAllPhotoAlbumInfo(albumList);

        // 获取相片的评论列表
        const images = API.Photos.toImages(imagesMapping);
        await API.Photos.getAllImagesComments(images);

        // 添加点赞Key
        API.Photos.addPhotoUniKey(images);

        // 获取相片赞记录
        await API.Photos.getPhotosLikeList(images);

        // 添加表情下载任务
        API.Photos.addDownloadEmoticonTasks(albumList);

        // 添加相片下载任务
        await API.Photos.addAlbumsDownloadTasks(albumList);

        // 根据导出类型导出数据
        await API.Photos.exportAllListToFiles(albumList);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Photos', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}

/** 转换相片集合（P2：委托 collectors/Photos） */
API.Photos.toImages = QZoneCollectors.Photos.toImages;

/** 获取所有相片的详情（P2：委托 collectors/Photos） */
API.Photos.getAllImagesInfos = QZoneCollectors.Photos.getAllImagesInfos;

/** 刷新所有相片的相册、分类信息（P2：委托 collectors/Photos） */
API.Photos.refreshAllPhotoAlbumInfo = QZoneCollectors.Photos.refreshAllPhotoAlbumInfo;

/** 刷新相片的相册、分类信息（P2：委托 collectors/Photos） */
API.Photos.refreshPhotoAlbumInfo = QZoneCollectors.Photos.refreshPhotoAlbumInfo;

/** 获取单页的相册列表（P2：委托 collectors/Photos） */
API.Photos.getAlbumPageList = QZoneCollectors.Photos.getAlbumPageList;

/** 获取所有的相册列表（P2：委托 collectors/Photos） */
API.Photos.getAllAlbumList = QZoneCollectors.Photos.getAllAlbumList;

/** 获取单个相册的指定页相片列表（P2：委托 collectors/Photos） */
API.Photos.getAlbumImagePageList = QZoneCollectors.Photos.getAlbumImagePageList;

/** 获取单个相册的全部相片列表（P2：委托 collectors/Photos） */
API.Photos.getAlbumImageAllList = QZoneCollectors.Photos.getAlbumImageAllList;

/** 基于详情列表接口获取单个相册的全部相片列表（P2：委托 collectors/Photos） */
API.Photos.getAlbumImageAllListByDetail = QZoneCollectors.Photos.getAlbumImageAllListByDetail;

/** 获取指定相册的相片列表（P2：委托 collectors/Photos） */
API.Photos.getAllAlbumImageList = QZoneCollectors.Photos.getAllAlbumImageList;

/** 基于相片详情列表接口获取指定相册的相片列表（P2：委托 collectors/Photos） */
API.Photos.getAllAlbumImageListByDetail = QZoneCollectors.Photos.getAllAlbumImageListByDetail;

/** 获取指定相册的相片列表（P2：委托 collectors/Photos） */
API.Photos.getAllAlbumImageListByListType = QZoneCollectors.Photos.getAllAlbumImageListByListType;

/** 获取单个相册的所有评论（P2：委托 collectors/Photos） */
API.Photos.getAlbumAllComments = QZoneCollectors.Photos.getAlbumAllComments;

/** 获取所有的相册的评论（P2：委托 collectors/Photos） */
API.Photos.getAllAlbumsComments = QZoneCollectors.Photos.getAllAlbumsComments;

/** 获取单张相片的所有评论（P2：委托 collectors/Photos） */
API.Photos.getImageAllComments = QZoneCollectors.Photos.getImageAllComments;

/** 获取所有的相片的评论（P2：委托 collectors/Photos） */
API.Photos.getAllImagesComments = QZoneCollectors.Photos.getAllImagesComments;

/** 添加所有相册的相片下载任务（P2：委托 collectors/Photos） */
API.Photos.addAlbumsDownloadTasks = QZoneCollectors.Photos.addAlbumsDownloadTasks;

/** 添加相册预览图的下载任务（P2：委托 collectors/Photos） */
API.Photos.addPreviewDownloadTasks = QZoneCollectors.Photos.addPreviewDownloadTasks;

/** 添加评论的下载任务（P2：委托 collectors/Photos） */
API.Photos.addCommentDownloadTasks = QZoneCollectors.Photos.addCommentDownloadTasks;

/** 添加单个相册的相片下载任务（P2：委托 collectors/Photos） */
API.Photos.addPhotosDownloadTasks = QZoneCollectors.Photos.addPhotosDownloadTasks;

/** 导出相册与相片（P2：委托 exporters/Photos） */
API.Photos.exportAllListToFiles = QZoneExporters.Photos.exportAllListToFiles;

/** 导出相册（P2：委托 exporters/Photos） */
API.Photos.exportAlbumsToFiles = QZoneExporters.Photos.exportAlbumsToFiles;

/** 导出相册到HTML文件（P2：委托 exporters/Photos） */
API.Photos.exportAlbumsToHtml = QZoneExporters.Photos.exportAlbumsToHtml;

/** 导出相册到MD文件（P2：委托 exporters/Photos） */
API.Photos.exportAlbumsToMarkdown = QZoneExporters.Photos.exportAlbumsToMarkdown;

/** 获取相册的Markdown内容（P2：委托 exporters/Photos） */
API.Photos.getAlbumsMarkdown = QZoneExporters.Photos.getAlbumsMarkdown;

/** 导出相册到JSON文件（P2：委托 exporters/Photos） */
API.Photos.exportAlbumsToJson = QZoneExporters.Photos.exportAlbumsToJson;

/** 导出相片（P2：委托 exporters/Photos） */
API.Photos.exportPhotosToFiles = QZoneExporters.Photos.exportPhotosToFiles;

/** 导出相册与相片到 SPA（P2：委托 exporters/Photos） */
API.Photos.exportToSpa = QZoneExporters.Photos.exportToSpa;

/** 导出相片到HTML文件（P2：委托 exporters/Photos） */
API.Photos.exportPhotosToHtml = QZoneExporters.Photos.exportPhotosToHtml;

/** 导出相片到MD文件（P2：委托 exporters/Photos） */
API.Photos.exportPhotosToMarkdown = QZoneExporters.Photos.exportPhotosToMarkdown;

/** 获取相片的MD内容（P2：委托 exporters/Photos） */
API.Photos.getPhotosMarkdownContents = QZoneExporters.Photos.getPhotosMarkdownContents;

/** 导出相片到JSON文件（P2：委托 exporters/Photos） */
API.Photos.exportPhotosToJson = QZoneExporters.Photos.exportPhotosToJson;

/** 导出类型是否为文件夹或文件（P2：委托 collectors/Photos） */
API.Photos.isFile = QZoneCollectors.Photos.isFile;

/** 根据相册ID获取相册列表中的相册（P2-3：委托 repos/modules/photos） */
API.Photos.getAlbumById = QZoneRepo.Photos.getAlbumById;

/** 根据相册ID获取相册列表中的相片列表（P2-3：委托 repos/modules/photos） */
API.Photos.getPhotosByAlbumId = QZoneRepo.Photos.getPhotosByAlbumId;

/** 是否增量条目（P2-3：委托 repos/modules/photos） */
API.Photos.isNewAlbum = QZoneRepo.Photos.isNewAlbum;

/** 是否增量条目（P2-3：委托 repos/modules/photos） */
API.Photos.isNewItem = QZoneRepo.Photos.isNewItem;

/** 初始化相册列表（P2：委托 collectors/Photos） */
API.Photos.initAlbums = QZoneCollectors.Photos.initAlbums;

/** 获取相册赞记录（P2：委托 collectors/Photos） */
API.Photos.getAlbumsLikeList = QZoneCollectors.Photos.getAlbumsLikeList;

/** 获取相片赞记录（P2：委托 collectors/Photos） */
API.Photos.getPhotosLikeList = QZoneCollectors.Photos.getPhotosLikeList;

/** 转换数据（P2：委托 collectors/Photos） */
API.Photos.addPhotoUniKey = QZoneCollectors.Photos.addPhotoUniKey;

/** 获取单条全部最近访问（P2：委托 collectors/Photos） */
API.Photos.getItemAllVisitorsList = QZoneCollectors.Photos.getItemAllVisitorsList;

/** 获取最近访问（P2：委托 collectors/Photos） */
API.Photos.getAllVisitorList = QZoneCollectors.Photos.getAllVisitorList;

/** 获取相册的文件夹（P2：委托 collectors/Photos） */
API.Photos.getAlbumFolderPath = QZoneCollectors.Photos.getAlbumFolderPath;

/** 重新排序（P2：委托 collectors/Photos） */
API.Photos.sortAlbums = QZoneCollectors.Photos.sortAlbums;

/** 重置相册排序号（P2：委托 collectors/Photos） */
API.Photos.resetAlbumOrderNumber = QZoneCollectors.Photos.resetAlbumOrderNumber;

/** 获取相片名称（P2：委托 collectors/Photos） */
API.Photos.getImageFileName = QZoneCollectors.Photos.getImageFileName;

/** 添加下载表情任务（P2：委托 collectors/Photos） */
API.Photos.addDownloadEmoticonTasks = QZoneCollectors.Photos.addDownloadEmoticonTasks;
