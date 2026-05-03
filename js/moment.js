let db = null;
const DB_NAME = 'sns';
const MOMENT_STORE_NAME = 'moments';
const IMAGE_STORE_NAME = 'images';
const DB_VERSION = 1;

const init = async function() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
                database.createObjectStore(IMAGE_STORE_NAME, { autoIncrement: true });
            }
            if (!database.objectStoreNames.contains(MOMENT_STORE_NAME)) {
                const momentStore = database.createObjectStore(MOMENT_STORE_NAME, { autoIncrement: true });
                momentStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}
init().then(async () => {
    for (const moment of await getAllMomentsFromDB()) {
        document.querySelector('.app').appendChild(await window.app['buildMoment'](moment));
    }
});;

const saveMomentToDB = async function(moment) {
    if (!db) throw new Error('数据库未初始化');
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MOMENT_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(MOMENT_STORE_NAME);
        const request = store.add(moment);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

const saveImageToIndexedDB = async function(file) {
    if (!db) throw new Error('数据库未初始化');
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(IMAGE_STORE_NAME);
        const request = store.add(file);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

const getAllMomentsFromDB = async function() {
    if (!db) throw new Error('数据库未初始化');
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MOMENT_STORE_NAME], 'readonly');
        const store = transaction.objectStore(MOMENT_STORE_NAME);
        const index = store.index('timestamp');
        const request = index.openCursor(null, 'prev'); // 倒序
        const moments = [];
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const moment = cursor.value;
                moment.id = cursor.primaryKey;
                moments.push(moment);
                cursor.continue();
            } else {
                resolve(moments);
            }
        };
        request.onerror = (e) => reject(e);
    });
}

const updateMomentInDB = async function(id, updatedMoment) {
    if (!db) throw new Error('数据库未初始化');
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MOMENT_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(MOMENT_STORE_NAME);
        const request = store.put(updatedMoment, id);  // put 会覆盖同 id 记录
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

const getImageById = async function(id) {
    if (!db) throw new Error('数据库未初始化');
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(IMAGE_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
}

const blobToBase64 = function(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]); // 只取 base64 数据部分
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 辅助函数：Base64 转 Blob
const base64ToBlob = function(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

window.app = {
    'author': 'clk',
    'pendingFiles': new Map(),
    'buildMoment': async function(data) {
        const momentData = data;
        let replyComment = null;

        const section = document.createElement('div');
        section.className = 'section';

        // ---- 头像区域 ----
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        const avatarImg = document.createElement('img');
        avatarImg.src = '../img/weixin-avatar.webp';
        avatarDiv.appendChild(avatarImg);

        // ---- 主体区域 .body ----
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'body';

        // 昵称
        const nicknameSpan = document.createElement('span');
        nicknameSpan.className = 'nickname';
        nicknameSpan.textContent = '侨高学子';

        // 正文
        const contentSpan = document.createElement('span');
        contentSpan.textContent = data['idea'];
        
        let gridDiv = null;
        if (data.photo && data.photo.length > 0) {
            gridDiv = document.createElement('div');
            gridDiv.className = 'image-grid';
            // 最多显示9张
            const photoIds = data.photo.slice(0, 9);
            for (let id of photoIds) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'grid-item';
                const img = document.createElement('img');
                // 异步加载图片
                try {
                    const fileBlob = await getImageById(id);
                    if (fileBlob) {
                        const url = URL.createObjectURL(fileBlob);
                        img.src = url;
                        // 可选：点击预览大图
                        img.addEventListener('click', () => window.app['previewImage']([url]));
                    }
                } catch(e) { console.warn(e); }
                itemDiv.appendChild(img);
                gridDiv.appendChild(itemDiv);
            }
        }

        // ---- extra 栏（时间、操作栏、更多按钮） ----
        const extraDiv = document.createElement('div');
        extraDiv.className = 'extra';

        const date = new Date(data['timestamp']);
        const timeSpan = document.createElement('span');
        timeSpan.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes()}`;

        // 操作按钮组（默认隐藏）
        const optionsBox = document.createElement('div');
        optionsBox.className = 'options-box hidden';

        // 赞按钮
        const likeBtn = document.createElement('a');
        likeBtn.className = 'btn';
        const likeIcon = document.createElement('span');
        likeIcon.className = 'icon-like';
        const likeText = document.createElement('span');
        likeText.textContent = '赞';
        if (data['like'] > 0) {
            likeIcon.classList.add('liked');
        }
        likeBtn.appendChild(likeIcon);
        likeBtn.appendChild(likeText);

        // 评论按钮
        const commentBtn = document.createElement('a');
        commentBtn.className = 'btn';
        const commentIcon = document.createElement('span');
        commentIcon.className = 'weui-icon-outlined-comment';
        commentIcon.style.marginRight = '.4em';
        const commentText = document.createElement('span');
        commentText.textContent = '评论';
        commentBtn.appendChild(commentIcon);
        commentBtn.appendChild(commentText);

        optionsBox.appendChild(likeBtn);
        optionsBox.appendChild(commentBtn);

        // 更多操作按钮（三个点）
        const optionsToggle = document.createElement('a');
        optionsToggle.className = 'options';
        const dot1 = document.createElement('span');
        dot1.className = 'dot';
        const dot2 = document.createElement('span');
        dot2.className = 'dot';
        // 实际上有三个点，但原 HTML 只写了两个 span，可能是样式生成。为了保持一致写两个
        optionsToggle.appendChild(dot1);
        optionsToggle.appendChild(dot2);

        // 组装 extra
        extraDiv.appendChild(timeSpan);
        extraDiv.appendChild(optionsBox);
        extraDiv.appendChild(optionsToggle);

        // ---- interaction 区域（点赞、已有评论、评论输入框） ----
        const interactionDiv = document.createElement('div');
        interactionDiv.className = 'interaction';

        if (data['comment'].length <= 0 && data['like'] <= 0) {
            interactionDiv.classList.add('hidden');
        }

        // 点赞行
        const likeRow = document.createElement('div');
        likeRow.className = 'like';
        const likeIconOutlined = document.createElement('span');
        likeIconOutlined.className = 'weui-icon-outlined-like';
        likeIconOutlined.style.marginRight = '.4em';
        const likeCountSpan = document.createElement('span');
        likeCountSpan.textContent = `侨高学子等共 ${data['like']} 人赞了`;
        if (data['like'] <= 0) {
            likeRow.classList.add('hidden');
        }
        likeRow.appendChild(likeIconOutlined);
        likeRow.appendChild(likeCountSpan);

        // 评论输入区域（隐藏）
        const commentArea = document.createElement('div');
        commentArea.className = 'comment-area hidden';
        const textarea = document.createElement('textarea');
        const postBtn = document.createElement('a');
        postBtn.id = 'post-btn';
        postBtn.className = 'weui-btn weui-btn_disabled weui-btn_primary';
        postBtn.textContent = '发送';
        commentArea.appendChild(textarea);
        commentArea.appendChild(postBtn);

        interactionDiv.appendChild(likeRow);
        interactionDiv.appendChild(commentArea);

        const buildComment = function(content, data, reply = false) {
            const commentRow = document.createElement('div');
            commentRow.className = 'comment';
            const commentNickname = document.createElement('span');
            commentNickname.className = 'nickname';
            commentNickname.textContent = '侨高学子';

            const commentReplyContent = document.createElement('span');
            commentReplyContent.textContent = ` 回复 `;
            const commentNicknameB = document.createElement('span');
            commentNicknameB.className = 'nickname';
            commentNicknameB.textContent = '侨高学子';

            const commentContent = document.createElement('span');
            commentContent.textContent = `：${content}`;
            commentRow.appendChild(commentNickname);
            if (reply) {
                commentRow.appendChild(commentReplyContent);
                commentRow.appendChild(commentNicknameB);
            }
            commentRow.appendChild(commentContent);
            commentRow.addEventListener('click', async function(e) {
                e.preventDefault();
                setTimeout(function() {
                    interactionDiv.classList.remove('hidden');
                    commentArea.classList.remove('hidden');
                });
                replyComment = data;
                textarea.placeholder = '回复 侨高学子';
                textarea.focus();
            });
            interactionDiv.insertBefore(commentRow, commentArea);
        }

        const buildCommentAndReplies = function(data, first = true) {
            buildComment(data['content'], data, !first);
            for (const reply of data['reply']) {
                buildCommentAndReplies(reply, false);
            }
        };

        // 现有评论行
        for (const comment of momentData['comment']) {
            buildCommentAndReplies(comment);
        }

        // 组装 body
        bodyDiv.appendChild(nicknameSpan);
        bodyDiv.appendChild(contentSpan);
        if (gridDiv) bodyDiv.appendChild(gridDiv); // 将网格插入正文下方
        bodyDiv.appendChild(extraDiv);
        bodyDiv.appendChild(interactionDiv);

        // 组装 section
        section.appendChild(avatarDiv);
        section.appendChild(bodyDiv);

        // ---------- 绑定交互事件 ----------
        // 1. 更多按钮：切换操作栏显示/隐藏
        optionsToggle.addEventListener('click', function(e) {
            e.preventDefault();
            setTimeout(function() { optionsBox.classList.toggle('hidden'); });
        });

        // 2. 赞按钮：增加点赞计数并改变图标样式
        likeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            interactionDiv.classList.remove('hidden');
            likeRow.classList.remove('hidden');
            momentData.like += 1;
            // 修改点赞文字（模拟当前用户点赞）
            likeCountSpan.textContent = `侨高学子等共 ${momentData.like} 人赞了`;
            // 可选：禁用再次点击，或做成可取消；为简单演示只做增
            updateMomentInDB(momentData.id, momentData).catch(console.error);
        });

        // 3. 评论按钮（操作栏中的“评论”）：显示评论输入区并聚焦
        commentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            setTimeout(function() {
                interactionDiv.classList.remove('hidden');
                commentArea.classList.remove('hidden');
            });
            replyComment = null;
            textarea.placeholder = '评论';
            textarea.focus();
            // 同时可隐藏操作栏（可选）
            optionsBox.classList.add('hidden');
        });

        // 4. 评论输入框实时校验，控制发送按钮可用性
        function updatePostButtonState() {
            if (textarea.value.trim() !== '') {
                postBtn.classList.remove('weui-btn_disabled');
                postBtn.classList.add('weui-btn_primary');
                postBtn.disabled = false;
            } else {
                postBtn.classList.add('weui-btn_disabled');
                postBtn.classList.remove('weui-btn_primary');
                postBtn.disabled = true;
            }
        }
        textarea.addEventListener('input', updatePostButtonState);
        updatePostButtonState(); // 初始状态

        // 5. 发送评论
        postBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const commentTextValue = textarea.value.trim();
            if (commentTextValue === '') return;
            
            const newCommentObj = { content: commentTextValue, reply: [] };
            if (replyComment == null) {
                momentData.comment.push(newCommentObj);
            } else {
                replyComment['reply'].push({ content: commentTextValue, reply: [] });
            }
            updateMomentInDB(momentData.id, momentData).catch(console.error);

            buildComment(commentTextValue, newCommentObj, replyComment != null);

            // 清空输入框、禁用发送按钮、重新隐藏评论输入区（可选）
            textarea.value = '';
            updatePostButtonState();
            commentArea.classList.add('hidden');
        });

        return section;
    },
    'importDatabase': async function(file) {
        if (!db) throw new Error('数据库未初始化');
        const loading = weui.loading('正在导入...');
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            if (!importData.moments || !importData.images) {
                throw new Error('无效的备份文件');
            }
            // 清空现有数据
            const clearTx = db.transaction([MOMENT_STORE_NAME, IMAGE_STORE_NAME], 'readwrite');
            await Promise.all([
                clearTx.objectStore(MOMENT_STORE_NAME).clear(),
                clearTx.objectStore(IMAGE_STORE_NAME).clear()
            ]);
            await new Promise((resolve, reject) => {
                clearTx.oncomplete = resolve;
                clearTx.onerror = () => reject(clearTx.error);
            });
            // 重建 images 仓库，记录旧 id -> 新 id 映射
            const idMap = new Map();
            const imageStore = db.transaction([IMAGE_STORE_NAME], 'readwrite').objectStore(IMAGE_STORE_NAME);
            for (const img of importData.images) {
                // 将 base64 转回 Blob
                const blob = base64ToBlob(img.base64, img.type);
                const request = imageStore.add(blob);
                const newId = await new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                idMap.set(img.id, newId);
            }
            // 重建 moments 仓库，并修正 photo 数组中的 id
            const momentStore = db.transaction([MOMENT_STORE_NAME], 'readwrite').objectStore(MOMENT_STORE_NAME);
            for (const moment of importData.moments) {
                // 更新 photo 数组中的旧图片 ID 为新 ID
                if (moment.photo && Array.isArray(moment.photo)) {
                    moment.photo = moment.photo.map(oldId => idMap.get(oldId) || oldId);
                }
                // 移除可能携带的临时 id 字段
                delete moment.id;
                await new Promise((resolve, reject) => {
                    const req = momentStore.add(moment);
                    req.onsuccess = resolve;
                    req.onerror = () => reject(req.error);
                });
            }
            // 刷新页面显示
            weui.toast('导入成功，即将刷新');
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            console.error(err);
            weui.alert('导入失败：' + err.message);
            loading.hide();
        }
    },
    'exportDatabase': async function() {
        if (!db) throw new Error('数据库未初始化');
        const loading = weui.loading('正在导出...');
        try {
            // 1. 读取所有 moments
            const moments = await getAllMomentsFromDB();
            // 2. 读取所有 images（转为 base64）
            const imagesMap = new Map(); // key -> { id, base64, type, name }
            const transaction = db.transaction([IMAGE_STORE_NAME], 'readonly');
            const store = transaction.objectStore(IMAGE_STORE_NAME);
            const allImages = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            for (let i = 0; i < allImages.length; i++) {
                const blob = allImages[i];
                const base64 = await blobToBase64(blob);
                imagesMap.set(i + 1, {   // IndexedDB autoIncrement 从1开始
                    id: i + 1,
                    base64: base64,
                    type: blob.type,
                    name: blob.name || 'image.jpg'
                });
            }
            // 3. 构建导出对象
            const exportData = {
                version: DB_VERSION,
                exportTime: Date.now(),
                moments: moments,
                images: Array.from(imagesMap.values())
            };
            // 4. 下载 JSON 文件
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sns_backup_${new Date().toISOString().slice(0,19)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            weui.toast('导出成功');
        } catch (err) {
            console.error(err);
            weui.alert('导出失败：' + err.message);
        } finally {
            loading.hide();
        }
    },
    'previewImage': async function(src) {
        document.getElementById('gallery').style.display = 'block';
        document.getElementById('galleryImg').style.backgroundImage = `url("${src}")`;
    }
};

document.getElementById('post').show = function() {
    const _this = document.getElementById('post');
    if (_this.classList.contains('hidden')) {
        _this.classList.remove('hidden');
    }
}

document.getElementById('post').hide = function() {
    const _this = document.getElementById('post');
    if (!_this.classList.contains('hidden')) {
        _this.classList.add('hidden');
    }
}

document.getElementById('idea').addEventListener('input', async function() {
    const _this = document.getElementById('idea');
    if (_this.value.trim() !== "" || window.app['pendingFiles'].size > 0) {
        document.getElementById('post-btn').classList.remove('weui-btn_disabled');
    } else {
        document.getElementById('post-btn').classList.add('weui-btn_disabled');
    }
    _this.style.height = 'auto';
    _this.style.height = `${_this.scrollHeight}px`;
});

document.getElementById('camera-btn').addEventListener('click', async function() {
    document.getElementById('post').show();
});

document.getElementById('post-btn').addEventListener('click', async function() {
    if (document.getElementById('post-btn').classList.contains('weui-btn_disabled')) {
        return;
    }
    document.getElementById('post').hide();
    const loading = weui.loading('正在加载');
    const moment = {
        'idea': document.getElementById('idea').value,
        'photo': [],
        'comment': [],
        'like': 0,
        'timestamp': Date.now()
    };
    document.getElementById('idea').value = '';
    for (const it of document.getElementById('uploader-files').children) {
        it.remove();
    }
    for (const [_, it] of window.app.pendingFiles) {
        moment['photo'].push(await saveImageToIndexedDB(it));
    }
    moment.id = (await saveMomentToDB(moment));
    document.querySelector('.app').querySelector('#post').after(await window.app['buildMoment'](moment));
    loading.hide();
    weui.toast('已完成');
});

document.getElementById('post-cancel-btn').addEventListener('click', async function() {
    for (const it of document.getElementById('uploader-files').children) {
        it.remove();
    }
    document.getElementById('idea').value = '';
    document.getElementById('post').hide();
});

document.addEventListener('DOMContentLoaded', function() {
    var uploaderInput = document.getElementById('uploader-input');
    var uploaderFiles = document.getElementById('uploader-files');

    var tmpl = '<li class="weui-uploader__file" role="img" aria-label="图片标题" title="轻点两下查看大图" tabindex="0" style="background-image:url(#url#)"></li>';
    var tmplWithDelete = '<li class="weui-uploader__file">' +
        '<span class="weui-uploader__file__thumb" role="img" aria-label="图片标题" title="轻点两下查看大图" tabindex="0" style="background-image:url(#url#)"></span>' +
        '<span class="weui-uploader__file__delete" role="button" title="删除">' +
        '<i class="weui-icon-close"></i>' +
        '</span>' +
        '</li>';

    var currentImg = null;

    function fadeIn(element, duration) {
        element.style.display = '';
        element.style.opacity = 0;
        var start = performance.now();
        function step(timestamp) {
            var elapsed = timestamp - start;
            var progress = Math.min(elapsed / duration, 1);
            element.style.opacity = progress;
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    }

    function fadeOut(element, duration) {
        var start = performance.now();
        var startOpacity = parseFloat(getComputedStyle(element).opacity);
        function step(timestamp) {
            var elapsed = timestamp - start;
            var progress = Math.min(elapsed / duration, 1);
            element.style.opacity = startOpacity * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                element.style.display = 'none';
                element.style.opacity = '';
            }
        }
        requestAnimationFrame(step);
    }

    function createObjectURLAndStore(file, targetElement, dataAttr) {
        var url = window.URL || window.webkitURL || window.mozURL;
        if (url) {
            var objectURL = url.createObjectURL(file);
            targetElement.setAttribute(dataAttr, objectURL);
            return objectURL;
        } else {
            var reader = new FileReader();
            reader.onload = function(e) {
                var dataURL = e.target.result;
                targetElement.setAttribute(dataAttr, dataURL);
                if (targetElement.tagName === 'LI') {
                    targetElement.style.backgroundImage = 'url(' + dataURL + ')';
                } else if (targetElement.classList.contains('weui-uploader__file__thumb')) {
                    targetElement.style.backgroundImage = 'url(' + dataURL + ')';
                }
            };
            reader.readAsDataURL(file);
            return null;
        }
    }

    function revokeObjectURL(element, dataAttr) {
        var url = element.getAttribute(dataAttr);
        if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
            if (window.URL && window.URL.revokeObjectURL) {
                window.URL.revokeObjectURL(url);
            }
            element.removeAttribute(dataAttr);
        }
    }

    if (uploaderInput && uploaderFiles) {
        uploaderInput.addEventListener('change', function(e) {
            var files = e.target.files;
            for (var i = 0, len = files.length; i < len; i++) {
                var file = files[i];
                var li = document.createElement('li');
                li.className = 'weui-uploader__file';
                var thumbSpan = document.createElement('span');
                thumbSpan.className = 'weui-uploader__file__thumb';
                thumbSpan.setAttribute('role', 'img');
                thumbSpan.setAttribute('aria-label', '图片标题');
                thumbSpan.setAttribute('tabindex', '0');
                var deleteSpan = document.createElement('span');
                deleteSpan.className = 'weui-uploader__file__delete';
                deleteSpan.setAttribute('role', 'button');
                deleteSpan.setAttribute('title', '删除');
                var icon = document.createElement('i');
                icon.className = 'weui-icon-close';
                deleteSpan.appendChild(icon);
                li.appendChild(thumbSpan);
                li.appendChild(deleteSpan);
                var objectURL = createObjectURLAndStore(file, thumbSpan, 'data-bloburl');
                if (objectURL) {
                    thumbSpan.style.backgroundImage = 'url(' + objectURL + ')';
                }
                uploaderFiles.appendChild(li);
                window.app['pendingFiles'].set(li, file);
            }
            uploaderInput.value = '';
            
            document.getElementById('post-btn').classList.remove('weui-btn_disabled');
        });

        uploaderFiles.addEventListener('click', function(e) {
            var target = e.target;
            while (target && target !== uploaderFiles) {
                if (target.classList && target.classList.contains('weui-uploader__file__delete')) {
                    e.stopPropagation();
                    var li = target.closest('li');
                    if (li) {
                        window.app['pendingFiles'].delete(li);

                        var thumb = li.querySelector('.weui-uploader__file__thumb');
                        if (thumb) {
                            revokeObjectURL(thumb, 'data-bloburl');
                        }
                        li.remove();
                    }
                    break;
                }
                target = target.parentNode;
            }
            
            if (document.getElementById('idea').value.trim() !== "" || window.app['pendingFiles'].size > 0) {
                document.getElementById('post-btn').classList.remove('weui-btn_disabled');
            } else {
                document.getElementById('post-btn').classList.add('weui-btn_disabled');
            }
        });
    }
});

document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

document.addEventListener('click', async function(e) {
    document.querySelectorAll('.comment-area:not(.hidden)').forEach(function(it) {
        if (!it.contains(event.target)) {
            it.querySelector('textarea').value = '';
            it.classList.add('hidden');
            if (it.parentElement.children.length <= 2 && it.parentElement.querySelectorAll('.hidden').length >= 2) {
                it.parentElement.classList.add('hidden');
            }
        }
    });
    document.querySelectorAll('.options-box:not(.hidden)').forEach(function(it) {
        if (!it.contains(event.target)) {
            it.classList.add('hidden');
        }
    });
});

document.getElementById('gallery').addEventListener('click', async function() {
    document.getElementById('gallery').style.display = 'none';
});