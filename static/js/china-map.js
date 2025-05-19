document.addEventListener('DOMContentLoaded', function() {
    // 获取传递的省份得分数据
    const provinceScores = window.provinceScores || {};
    console.log("省份得分数据:", provinceScores);

    // 检查是否为空对象
    const hasScores = Object.keys(provinceScores).length > 0;
    console.log("是否有省份得分数据:", hasScores);

    if (!hasScores) {
        console.error("警告: 没有省份得分数据!");
        document.getElementById('china-map-container').innerHTML =
            '<div class="error-message">No province score data available</div>';
        return;
    }

    // 检查数据格式
    const sampleKeys = Object.keys(provinceScores).slice(0, 5);
    console.log("示例省份ID:", sampleKeys);
    console.log("对应得分:", sampleKeys.map(id => provinceScores[id]));

    // 省份ID验证函数
    function isValidProvinceId(id) {
    return /^[0-9]{2}$/.test(id) || /^CN[A-Z]{2}$/.test(id);
    }

    // 检查ID格式
    const invalidIds = Object.keys(provinceScores).filter(id => !isValidProvinceId(id));
    if (invalidIds.length > 0) {
        console.error("警告: 发现无效的省份ID:", invalidIds);
    }

    // 定义地图尺寸
    const width = 800;
    const height = 600;

    // 创建SVG元素
    const svg = d3.select('#china-map-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'max-width: 100%; height: auto;');

    // 创建颜色比例尺 - 从浅绿色到深绿色
    const colorScale = d3.scaleLinear()
        .domain([0, 100])  // 得分范围为0-100
        .range(['#e5f5e0', '#31a354'])
        .clamp(true);

    // 添加图例
    const legendWidth = 200;
    const legendHeight = 20;

    const legend = svg.append('g')
        .attr('transform', `translate(${width - legendWidth - 20}, 20)`);

    // 添加图例标题
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Compatibility Score');

    // 创建渐变
    const defs = legend.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');

    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#e5f5e0');

    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#31a354');

    // 添加渐变矩形
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)');

    // 添加刻度
    const legendScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .tickValues([0, 25, 50, 75, 100])
        .tickFormat(d => `${d}%`);

    legend.append('g')
        .attr('transform', `translate(0, ${legendHeight})`)
        .call(legendAxis);

d3.json('/static/assets/cn.json').then(function(chinaData) {
    console.log("加载地图数据成功");

    // 检查地图数据结构
    if (!chinaData || !chinaData.features || !Array.isArray(chinaData.features)) {
        console.error("地图数据格式无效:", chinaData);
        document.getElementById('china-map-container').innerHTML =
            '<div class="error-message">Invalid map data format</div>';
        return;
    }

    console.log("地图包含省份数量:", chinaData.features.length);

    // 检查地图中第一个省份的结构
    if (chinaData.features.length > 0) {
        const firstProvince = chinaData.features[0];
        console.log("示例省份数据:", {
            id: firstProvince.properties.id,
            name: firstProvince.properties.name,
            hasGeometry: !!firstProvince.geometry
        });
    }

    // 检查ID匹配情况
    const mapIds = chinaData.features.map(f => f.properties.id);
    console.log("地图中的省份ID:", mapIds);

    const matchedIds = Object.keys(provinceScores).filter(id => mapIds.includes(id));
    console.log("匹配的省份ID数量:", matchedIds.length, "总省份数:", mapIds.length);

    if (matchedIds.length === 0) {
        console.error("严重错误: 没有匹配的省份ID!");
        document.getElementById('china-map-container').innerHTML =
            '<div class="error-message">No matching province IDs between scores and map data</div>';
    }

        try {
            // 创建地理投影
            const projection = d3.geoMercator()
                .center([105, 38])  // 中国中心点大约在这个位置
                .scale(650)
                .translate([width / 2, height / 2]);

            // 创建路径生成器
            const path = d3.geoPath().projection(projection);

            // 绘制省份
            svg.selectAll('path')
                .data(chinaData.features)
                .enter()
                .append('path')
                .attr('d', path)
                .attr('fill', d => {
                    // 获取省份ID
                    const provinceId = d.properties.id;
                    // 获取该省份的得分，如果没有则为0
                    const score = provinceScores[provinceId] || 0;
                    // 应用颜色比例尺
                    return colorScale(score);
                })
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5)
                .attr('class', 'province')
                .on('mouseover', function(event, d) {
                    // 高亮显示
                    d3.select(this)
                        .attr('stroke', '#333')
                        .attr('stroke-width', 1.5);

                    // 显示提示
                    const provinceId = d.properties.id;
                    const provinceName = d.properties.name;
                    const score = provinceScores[provinceId] || 0;

                    // 创建或更新提示框
                    const tooltip = d3.select('#tooltip');
                    if (tooltip.empty()) {
                        d3.select('body')
                            .append('div')
                            .attr('id', 'tooltip')
                            .style('position', 'absolute')
                            .style('background', 'rgba(255, 255, 255, 0.9)')
                            .style('padding', '8px')
                            .style('border-radius', '4px')
                            .style('box-shadow', '0 2px 10px rgba(0,0,0,0.2)')
                            .style('pointer-events', 'none')
                            .style('z-index', 100);
                    }

                    // 更新提示内容和位置
                    d3.select('#tooltip')
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px')
                        .style('display', 'block')
                        .html(`<strong>${provinceName}</strong><br>Match: ${score.toFixed(1)}%`);
                })
                .on('mouseout', function() {
                    // 恢复样式
                    d3.select(this)
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 0.5);

                    // 隐藏提示
                    d3.select('#tooltip').style('display', 'none');
                });

            // 添加省份名称标签（仅对较大的省份）
            svg.selectAll('text.province-label')
                .data(chinaData.features)
                .enter()
                .append('text')
                .attr('class', 'province-label')
                .filter(d => {
                    // 根据面积筛选，只显示较大省份的标签
                    const area = path.area(d);
                    return area > 200; // 根据实际情况调整阈值
                })
                .attr('transform', d => {
                    // 计算省份的质心点
                    const centroid = path.centroid(d);
                    return `translate(${centroid[0]}, ${centroid[1]})`;
                })
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('fill', d => {
                    const provinceId = d.properties.id;
                    const score = provinceScores[provinceId] || 0;
                    // 深色背景使用白色文字，浅色背景使用黑色文字
                    return score > 60 ? '#fff' : '#333';
                })
                .text(d => d.properties.name);
        } catch (error) {
            console.error("渲染地图时出错:", error);
            document.getElementById('china-map-container').innerHTML =
                `<div class="error-message">Error rendering map: ${error.message}</div>`;
        }
    }).catch(function(error) {
        console.error('加载地图数据出错:', error);
        document.getElementById('china-map-container').innerHTML =
            `<div class="error-message">Error loading map data: ${error.message}</div>`;
    });
});