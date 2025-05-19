class AvatarCreator {

    constructor(resources) {

        this.resources = resources;
        // 手动设置初始组件
        this.initialComponents = {
            body: 'Dress.svg',   // 替换成你想要的具体文件名
            head: 'Bun.svg',    // 替换成你想要的具体文件名
            face: 'Smile.svg',    // 替换成你想要的具体文件名
            facial_hair: 'none.svg',
            accessories: 'none.svg'
        };

        this.currentSelection = {
            body: this.initialComponents.body,
            head: this.initialComponents.head,
            face: this.initialComponents.face,
            facial_hair: this.initialComponents.facial_hair,
            accessories: this.initialComponents.accessories
        };
        this.currentSelection = {
            body: null,
            head: null,
            face: null,
            facial_hair: null,
            accessories: null
        };
        this.svgCache = {}; // 缓存加载的SVG内容

        // 添加组件位置信息
        this.componentPositions = {
            body: {x: 147, y: 639},
            head: {x: 372, y: 180},
            face: {x: 531, y: 366},
            facial_hair: {x: 495, y: 518},
            accessories: {x: 419, y: 421}
        };

        // 设置模板的viewBox
        this.templateViewBox = "0 0 1136 1533";

        console.log("初始化AvatarCreator，资源：", this.resources);
    }

// 在构造函数之后或初始化方法开始时添加这段代码
    initialize() {
        console.log("开始初始化组件...");

        // 确保 facial_hair 和 accessories 类别中的 none.svg 位于第一位
        ['facial_hair', 'accessories'].forEach(category => {
            if (this.resources[category] && this.resources[category].length > 0) {
                // 检查是否包含 none.svg
                const noneIndex = this.resources[category].indexOf('none.svg');

                if (noneIndex !== -1) {
                    // 如果找到 none.svg，将其从原位置移除并插入到列表开头
                    this.resources[category].splice(noneIndex, 1);
                    this.resources[category].unshift('none.svg');
                    console.log(`Moved none.svg to the first position in ${category}`);
                }
            }
        });

        // 设置主SVG的viewBox
        const avatarSvg = document.getElementById('avatar-svg');
        if (avatarSvg) {
            avatarSvg.setAttribute('viewBox', this.templateViewBox);
        }

        // 设置各层位置
        Object.keys(this.componentPositions).forEach(category => {
            const layer = document.getElementById(`${category}-layer`);
            if (layer) {
                const pos = this.componentPositions[category];
                layer.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
            }
        });

        // 初始化选项面板
        Object.keys(this.resources).forEach(category => {
            console.log(`开始初始化${category}面板，有${this.resources[category].length}个选项`);
            this.populateOptions(category);
        });

        // 设置默认选择
        this.setDefaultSelections();
    }

    setLayerPositions() {
        // 根据提供的SVG设置各层位置
        const bodyLayer = document.getElementById('body-layer');
        if (bodyLayer) {
            bodyLayer.setAttribute('transform', 'translate(147, 639)');
        }

        const headLayer = document.getElementById('head-layer');
        if (headLayer) {
            headLayer.setAttribute('transform', 'translate(372, 180)');
        }

        const faceLayer = document.getElementById('face-layer');
        if (faceLayer) {
            faceLayer.setAttribute('transform', 'translate(531, 366)');
        }

        const facialHairLayer = document.getElementById('facial_hair-layer');
        if (facialHairLayer) {
            facialHairLayer.setAttribute('transform', 'translate(494.999934, 517.999659)');
        }

        const accessoriesLayer = document.getElementById('accessories-layer');
        if (accessoriesLayer) {
            accessoriesLayer.setAttribute('transform', 'translate(419, 421)');
        }
    }

    populateOptions(category) {
        const container = document.getElementById(`${category}-options`);

        // 检查容器是否存在
        if (!container) {
            console.error(`未找到${category}-options容器元素`);
            return;
        }

        container.innerHTML = '';

        // 检查是否有该类别的资源
        if (!this.resources[category] || this.resources[category].length === 0) {
            console.warn(`${category}类别没有资源`);
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = `没有可用的${category}选项`;
            container.appendChild(emptyMsg);
            return;
        }

        // 添加选项
        this.resources[category].forEach(item => {
            const option = document.createElement('div');
            option.className = 'option-item';

            // 创建预览图
            const preview = document.createElement('div');
            preview.className = 'preview-container';

            // 添加加载指示
            preview.innerHTML = '<div class="loading">加载中...</div>';

            // 加载SVG并在预览中显示
            const svgUrl = `/static/assets/${category.replace('_', '-')}/${item}`;
            console.log(`加载SVG: ${svgUrl}`);

            fetch(svgUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP错误! 状态: ${response.status}`);
                    }
                    return response.text();
                })
                .then(svgText => {
                    // 移除加载指示
                    preview.innerHTML = '';

                    // 添加SVG到预览
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = svgText;
                    const svgElement = tempDiv.querySelector('svg');

                    if (!svgElement) {
                        console.error(`加载的SVG内容中没有找到svg元素: ${svgUrl}`);
                        preview.innerHTML = '<div class="error">SVG加载失败</div>';
                        return;
                    }

                    // 调整SVG大小以适应预览容器
                    svgElement.setAttribute('width', '100%');
                    svgElement.setAttribute('height', '100%');

                    preview.appendChild(svgElement);

                    // // 为预览应用肤色
                    // preview.querySelectorAll('path, ellipse, circle, rect').forEach(element => {
                    //     if (element.hasAttribute('fill')) {
                    //         element.style.fill = '#000000';
                    //     }
                    // });

                    // 缓存SVG内容
                    this.svgCache[`${category}/${item}`] = svgText;

                    // 如果这个选项是当前选中的，更新显示
                    if (this.currentSelection[category] === item) {
                        this.selectItem(category, item);
                    }
                })
                .catch(error => {
                    console.error(`加载SVG失败: ${svgUrl}`, error);
                    preview.innerHTML = '<div class="error">SVG加载失败</div>';
                });

            option.appendChild(preview);

            // 添加标题
            const title = document.createElement('div');
            title.className = 'option-title';
            title.textContent = item.replace('.svg', '');
            option.appendChild(title);

            // 添加点击事件
            option.addEventListener('click', () => {
                this.selectItem(category, item);

                // 移除其他选项的选中状态
                container.querySelectorAll('.option-item').forEach(
                    opt => opt.classList.remove('selected')
                );

                // 添加选中状态
                option.classList.add('selected');
            });

            container.appendChild(option);
        });
    }

// 在 avatar.js 中修改 selectItem 方法
    selectItem(category, item) {
        console.log(`选择项目: ${category} / ${item}`);
        this.currentSelection[category] = item;

        // 获取对应的SVG层
        const layerId = `${category}-layer`;
        const layer = document.getElementById(layerId);

        if (!layer) {
            console.error(`未找到图层: ${layerId}`);
            return;
        }

        // 清空当前层
        layer.innerHTML = '';

        // 如果是"无"选项，直接返回
        if (item === 'none.svg') {
            return;
        }

        // 如果有选择项且已缓存
        if (item && this.svgCache[`${category}/${item}`]) {
            try {
                // 解析SVG内容
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(this.svgCache[`${category}/${item}`], "image/svg+xml");

                // 检查解析错误
                const parserError = svgDoc.querySelector('parsererror');
                if (parserError) {
                    console.error(`解析SVG时出错: ${category}/${item}`, parserError);
                    return;
                }

                const svgElement = svgDoc.documentElement;

                // 移除原SVG的宽高属性，将在父SVG中设置
                svgElement.removeAttribute('width');
                svgElement.removeAttribute('height');

                // 保留viewBox以确保正确显示
                const viewBox = svgElement.getAttribute('viewBox');

                // 创建一个组元素来包含SVG内容
                const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                if (viewBox) {
                    g.setAttribute('data-viewbox', viewBox);
                }

                // 将SVG内容添加到组中，不修改任何填充颜色
                Array.from(svgElement.children).forEach(child => {
                    const newChild = child.cloneNode(true);
                    g.appendChild(newChild);
                });

                layer.appendChild(g);
                console.log(`成功添加SVG到图层: ${layerId}`);
            } catch (error) {
                console.error(`处理SVG时出错: ${category}/${item}`, error);
            }
        } else {
            console.log(`未找到缓存的SVG: ${category}/${item}`);
        }
    }

    setDefaultSelections() {
        // 遍历所有类别，设置初始选择
        Object.keys(this.resources).forEach(category => {
            if (this.resources[category] && this.resources[category].length > 0) {
                // 获取初始设置的组件名
                const initialComponent = this.initialComponents[category];

                // 查找对应组件在资源列表中的索引
                const componentIndex = this.resources[category].findIndex(item => item === initialComponent);

                if (componentIndex !== -1) {
                    console.log(`设置${category}的初始组件: ${initialComponent}`);

                    // 选中对应选项
                    const options = document.querySelectorAll(`#${category}-options .option-item`);
                    if (options && options.length > componentIndex) {
                        options[componentIndex].classList.add('selected');
                        // 组件加载完成后会调用selectItem，这里只设置UI状态
                    } else {
                        console.warn(`未找到${category}的对应选项元素`);
                    }
                } else {
                    console.warn(`在资源中未找到初始组件: ${initialComponent}`);
                    // 如果找不到初始组件，默认选择第一个
                    const firstOption = document.querySelector(`#${category}-options .option-item`);
                    if (firstOption) {
                        firstOption.classList.add('selected');
                        this.currentSelection[category] = this.resources[category][0];
                    }
                }
            } else {
                console.warn(`${category}没有可用选项`);
            }
        });

        // 确保初始组件显示
        Object.keys(this.initialComponents).forEach(category => {
            this.selectItem(category, this.initialComponents[category]);
        });
    }

    randomize() {
        // 为每个类别随机选择一个选项
        ['body', 'head', 'face'].forEach(category => {
            if (this.resources[category] && this.resources[category].length > 0) {
                const randomIndex = Math.floor(Math.random() * this.resources[category].length);
                const randomItem = this.resources[category][randomIndex];

                this.selectItem(category, randomItem);

                // 更新UI选中状态
                document.querySelectorAll(`#${category}-options .option-item`).forEach(
                    (opt, index) => {
                        opt.classList.toggle('selected', index === randomIndex);
                    }
                );
            }
        });

        // 随机肤色
        const colorOptions = document.querySelectorAll('.color-option');
        if (colorOptions.length > 0) {
            const randomColorIndex = Math.floor(Math.random() * colorOptions.length);
            colorOptions.forEach((opt, index) => {
                opt.classList.toggle('selected', index === randomColorIndex);
            });

            this.skinColor = colorOptions[randomColorIndex].getAttribute('data-color');
            this.updateSkinColor();
        }
    }

    downloadAvatar() {
        // 准备SVG以便下载
        const avatarSvg = document.getElementById('avatar-svg');
        if (!avatarSvg) {
            console.error('未找到avatar-svg元素');
            return;
        }

        // 克隆SVG以避免修改原始SVG
        const clonedSvg = avatarSvg.cloneNode(true);

        // 确保SVG有正确的命名空间
        if (!clonedSvg.getAttribute('xmlns')) {
            clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }

        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const svgUrl = URL.createObjectURL(svgBlob);

        // 创建图像以将SVG转换为PNG
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, 400, 500);

            // 创建下载链接
            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = 'my-avatar.png';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // 释放对象URL
            URL.revokeObjectURL(svgUrl);
        };
        img.onerror = function (error) {
            console.error('图像加载失败', error);
            alert('下载失败，请重试');
        };
        img.src = svgUrl;
    }
}
