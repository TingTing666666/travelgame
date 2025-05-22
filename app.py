from flask import Flask, render_template, jsonify, request, redirect, url_for, session
import os
import json
import pandas as pd
import numpy as np
import os
import pickle
import base64

app = Flask(__name__)
app.secret_key = 'dev-secret-key-for-testing'
app.config['SESSION_COOKIE_SECURE'] = False  # 开发环境设为False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 会话持续时间（秒）

@app.route('/debug_routes')
def debug_routes():
    """输出所有注册的路由"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            "endpoint": rule.endpoint,
            "methods": list(rule.methods),
            "route": str(rule)
        })
    return jsonify({"routes": routes})

# 会话数据序列化函数
def serialize_session_data(data):
    return base64.b64encode(pickle.dumps(data)).decode('utf-8')

def deserialize_session_data(data_str):
    try:
        return pickle.loads(base64.b64decode(data_str.encode('utf-8')))
    except:
        return None

@app.route('/')
def home():
    """主页"""
    return render_template('index.html')


@app.route('/create-avatar')
def create_avatar():
    """角色创建页面"""
    resource_data = {
        'body': get_resource_files('static/assets/body'),
        'head': get_resource_files('static/assets/head'),
        'face': get_resource_files('static/assets/face'),
        'facial_hair': get_resource_files('static/assets/facial-hair'),
        'accessories': get_resource_files('static/assets/accessories')
    }

    # 确保 facial_hair 和 accessories 类别中的 none.svg 位于第一位
    for category in ['facial_hair', 'accessories']:
        if 'none.svg' in resource_data[category]:
            resource_data[category].remove('none.svg')
            resource_data[category].insert(0, 'none.svg')

    print("找到的资源：", resource_data)
    resource_json = json.dumps(resource_data)
    return render_template('avatar.html', resource_json=resource_json)


@app.route('/save-avatar', methods=['POST'])
def save_avatar():
    """保存角色信息"""
    if request.method == 'POST':
        try:
            data = request.json

            # 存储用户名
            session['name'] = data.get('name')

            # 序列化存储选择数据
            if 'selections' in data:
                selections_data = data.get('selections')
                session['avatar_selections'] = selections_data
                # 备份为字符串以防对象存储失败
                session['avatar_selections_backup'] = serialize_session_data(selections_data)

            # 强制更新session
            session.modified = True

            print(f"Session updated: name={session.get('name')}")
            return jsonify({"success": True})
        except Exception as e:
            print(f"保存头像出错: {str(e)}")
            return jsonify({"success": False, "error": str(e)})


@app.route('/questionnaire')
def questionnaire():
    """问卷调查页面"""
    print("=== /questionnaire 路由被调用 ===")

    # 检查会话数据
    if 'name' not in session:
        print("session中没有找到name，重定向到create_avatar")
        return redirect(url_for('create_avatar'))

    # 尝试获取头像选择
    avatar_selections = None

    # 首先尝试直接获取
    if 'avatar_selections' in session:
        avatar_selections = session.get('avatar_selections')

    # 如果获取失败，尝试从备份恢复
    if not avatar_selections and 'avatar_selections_backup' in session:
        backup_data = session.get('avatar_selections_backup')
        avatar_selections = deserialize_session_data(backup_data)

        # 恢复成功后更新会话
        if avatar_selections:
            session['avatar_selections'] = avatar_selections
            session.modified = True

    # 如果仍然失败，使用默认值
    if not avatar_selections:
        avatar_selections = {}

    # 问卷选项
    questions = {
        'travel_style': ['Adventure', 'Relaxation', 'Cultural', 'Luxury', 'Eco-friendly', 'Modern'],
        'activities': ['Food & Cuisine', 'Sports & Activities', 'Sightseeing', 'Shopping', 'History & Culture'],
        'transportation': ['Drive', 'Walk', 'Public Transit', 'Bicycle', 'Guided Tour'],
        'accommodation': ['Hostel', 'Homestay', 'Hotel', 'Resort', 'Camping'],
        'budget': ['$0-$5000', '$5000-$10000', '$10000-$50000', '$50000+'],
        'duration': ['1 day', '3 days', '7 days', '14 days', '30+ days']
    }

    return render_template('questionnaire.html',
                           name=session['name'],
                           avatar_selections=avatar_selections,
                           questions=questions)

@app.route('/process-questionnaire', methods=['POST'])
def process_questionnaire():
    """处理问卷结果"""
    if request.method == 'POST':
        data = request.json
        # 数据现在是 {category: [选项1, 选项2, ...]}
        session['preferences'] = data
        session.modified = True
        return jsonify({"success": True})


@app.route('/check-shaanxi')
def check_shaanxi():
    """检查陕西的地图数据"""
    try:
        import json
        map_path = os.path.join('static', 'assets', 'cn.json')

        with open(map_path, 'r', encoding='utf-8') as f:
            map_data = json.load(f)

        shaanxi_data = None
        for feature in map_data.get('features', []):
            properties = feature.get('properties', {})
            if properties.get('name') == '陕西':
                shaanxi_data = {
                    'id': properties.get('id'),
                    'name': properties.get('name'),
                    'feature_id': feature.get('id'),
                    'has_geometry': 'geometry' in feature
                }
                break

        return jsonify({
            'found': shaanxi_data is not None,
            'data': shaanxi_data
        })
    except Exception as e:
        return jsonify({'error': str(e)})


@app.route('/results')
def results():
    """显示旅行推荐结果"""
    if 'preferences' not in session:
        return redirect(url_for('questionnaire'))

    # 检查是否有头像选择
    if 'avatar_selections' not in session:
        # 如果没有，提供一个默认值
        avatar_selections = {}
    else:
        avatar_selections = session['avatar_selections']

    # 计算省份符合度
    province_scores = calculate_province_scores(session['preferences'])

    # 使用省份分数计算顶级目的地推荐
    recommendations = calculate_top_destinations(province_scores)

    return render_template('result.html',
                           name=session['name'],
                           avatar_selections=avatar_selections,
                           preferences=session['preferences'],
                           province_scores=province_scores,
                           recommendations=recommendations)


def calculate_province_scores(preferences):
    """计算每个省份的符合度得分"""
    try:
        # 省份名称到数字ID的映射关系（保持不变）
        province_name_to_id = {
            "北京": "11",
            "天津": "12",
            "河北": "13",
            "山西": "14",
            "内蒙古": "15",
            "辽宁": "21",
            "吉林": "22",
            "黑龙江": "23",
            "上海": "31",
            "江苏": "32",
            "浙江": "33",
            "安徽": "34",
            "福建": "35",
            "江西": "36",
            "山东": "37",
            "河南": "41",
            "湖北": "42",
            "湖南": "43",
            "广东": "44",
            "广西": "45",
            "海南": "46",
            "重庆": "50",
            "四川": "51",
            "贵州": "52",
            "云南": "53",
            "西藏": "54",
            "陕西": "61",
            "甘肃": "62",
            "青海": "63",
            "宁夏": "64",
            "新疆": "65",
            "台湾": "71",
            "香港": "81",
            "澳门": "82"
        }

        # 添加数字ID到地图ID的映射
        province_id_to_map_id = {
            "11": "CNBJ",  # 北京
            "12": "CNTJ",  # 天津
            "13": "CNHE",  # 河北
            "14": "CNSX",  # 山西
            "15": "CNMN",  # 内蒙古
            "21": "CNLN",  # 辽宁
            "22": "CNJL",  # 吉林
            "23": "CNHL",  # 黑龙江
            "31": "CNSH",  # 上海
            "32": "CNJS",  # 江苏
            "33": "CNZJ",  # 浙江
            "34": "CNAH",  # 安徽
            "35": "CNFJ",  # 福建
            "36": "CNJX",  # 江西
            "37": "CNSD",  # 山东
            "41": "CNHA",  # 河南
            "42": "CNHB",  # 湖北
            "43": "CNHN",  # 湖南
            "44": "CNGD",  # 广东
            "45": "CNGX",  # 广西
            "46": "CNHI",  # 海南
            "50": "CNCQ",  # 重庆
            "51": "CNSC",  # 四川
            "52": "CNGZ",  # 贵州
            "53": "CNYN",  # 云南
            "54": "CNXZ",  # 西藏
            "61": "CNSN",  # 陕西
            "62": "CNGS",  # 甘肃
            "63": "CNQH",  # 青海
            "64": "CNNX",  # 宁夏
            "65": "CNXJ",  # 新疆
            "71": "CNTW",  # 台湾
            "81": "CNHK",  # 香港
            "82": "CNMO"  # 澳门
        }

        # 加载省份数据
        csv_path = os.path.join('static', 'assets', 'cdata.csv')
        df = pd.read_csv(csv_path, encoding='gbk')

        # 打印CSV的列名和前几行
        print("CSV列名:", df.columns.tolist())
        print("CSV前两行:", df.head(2).to_dict('records'))

        # 准备存储结果
        scores = {}

        # 扁平化用户选择
        all_selected_options = []
        for category, selected_options in preferences.items():
            if isinstance(selected_options, list):
                all_selected_options.extend(selected_options)

        print("用户选择的所有选项:", all_selected_options)

        # 对于每个省份，计算符合度
        for _, row in df.iterrows():
            province_name = row['id']  # 获取省份名称

            # 使用映射关系将省份名称转换为ID
            if province_name in province_name_to_id:
                province_id = province_name_to_id[province_name]
            else:
                print(f"警告: 找不到省份 '{province_name}' 的ID映射")
                continue  # 跳过这个省份

            province_scores = []

            # 对用户选择的每个选项计算得分
            for option in all_selected_options:
                if option in df.columns:
                    score = row[option]
                    if pd.notna(score):  # 确保不是NaN值
                        try:
                            score_float = float(score)
                            province_scores.append(score_float)
                        except (ValueError, TypeError):
                            print(f"警告: 选项 '{option}' 的值 '{score}' 无法转换为数字")

            # 计算平均得分
            if province_scores:
                avg_score = sum(province_scores) / len(province_scores)
                scores[province_id] = round(avg_score, 1)
            else:
                scores[province_id] = 0

        print("原始省份得分:", scores)

        # 归一化处理
        if scores:
            max_score = max(scores.values()) if scores else 100
            min_score = min(scores.values()) if scores else 0

            print(f"得分范围: {min_score} - {max_score}")

            range_score = max_score - min_score
            if range_score > 0:
                for province_id in scores:
                    normalized_score = ((scores[province_id] - min_score) / range_score) * 100
                    scores[province_id] = round(normalized_score, 1)

        # 注意：这里移除了原来的 return scores，改为在转换后返回
        # 在计算完成后添加陕西专项检查
        print("检查陕西的数据处理:")
        if "61" in scores:
            print(f"- 陕西的标准ID得分: {scores['61']}")
        else:
            print("- 陕西的标准ID '61' 不在得分中!")

        # 转换ID格式
        map_compatible_scores = {}
        for province_id, score in scores.items():
            # 特别关注陕西
            if province_id == "61":
                print(f"- 处理陕西ID转换: {province_id} -> {province_id_to_map_id.get(province_id, 'Not Found')}")

            if province_id in province_id_to_map_id:
                map_id = province_id_to_map_id[province_id]
                map_compatible_scores[map_id] = score

                # 再次检查陕西
                if province_id == "61":
                    print(f"- 陕西转换后ID和得分: {map_id} = {score}")
            else:
                print(f"警告: 找不到省份代码 {province_id} 对应的地图ID")

        # 最终检查
        if "CNSN" in map_compatible_scores:
            print(f"- 最终数据中陕西 (CNSN) 的得分: {map_compatible_scores['CNSN']}")
        else:
            print("- 警告: 最终数据中没有陕西 (CNSN)!")

        # 找出丢失的省份
        if len(map_compatible_scores) < len(province_id_to_map_id):
            missing_provinces = []
            for province_id, map_id in province_id_to_map_id.items():
                if map_id not in map_compatible_scores:
                    # 查找省份名称
                    province_name = next(
                        (name for name, id_code in province_name_to_id.items() if id_code == province_id), "未知")
                    missing_provinces.append(f"{province_name} ({province_id} -> {map_id})")

            print(f"- 缺失的省份: {', '.join(missing_provinces)}")
        # # 在计算完成后，转换ID格式
        # map_compatible_scores = {}
        # for province_id, score in scores.items():
        #     if province_id in province_id_to_map_id:
        #         map_id = province_id_to_map_id[province_id]
        #         map_compatible_scores[map_id] = score
        #     else:
        #         print(f"警告: 找不到省份代码 {province_id} 对应的地图ID")

        print("地图兼容的省份得分:", map_compatible_scores)
        return map_compatible_scores  # 返回转换后的得分



    except Exception as e:
        print(f"计算省份得分时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}


def get_resource_files(directory):
    """获取资源文件列表"""
    if not os.path.exists(directory):
        print(f"Warning: Directory {directory} does not exist")
        return []

    files = [f for f in os.listdir(directory)
             if f.endswith('.svg') and os.path.isfile(os.path.join(directory, f))]

    print(f"Found {len(files)} SVG files in {directory}")
    return files


def calculate_top_destinations(province_scores):
    """根据省份匹配度计算顶级目的地推荐"""
    try:
        # 创建地图ID到省份名称的映射
        map_id_to_province_name = {
            "CNBJ": "北京",
            "CNTJ": "天津",
            "CNHE": "河北",
            "CNSX": "山西",
            "CNMN": "内蒙古",
            "CNLN": "辽宁",
            "CNJL": "吉林",
            "CNHL": "黑龙江",
            "CNSH": "上海",
            "CNJS": "江苏",
            "CNZJ": "浙江",
            "CNAH": "安徽",
            "CNFJ": "福建",
            "CNJX": "江西",
            "CNSD": "山东",
            "CNHA": "河南",
            "CNHB": "湖北",
            "CNHN": "湖南",
            "CNGD": "广东",
            "CNGX": "广西",
            "CNHI": "海南",
            "CNCQ": "重庆",
            "CNSC": "四川",
            "CNGZ": "贵州",
            "CNYN": "云南",
            "CNXZ": "西藏",
            "CNSN": "陕西",
            "CNGS": "甘肃",
            "CNQH": "青海",
            "CNNX": "宁夏",
            "CNXJ": "新疆",
            "CNTW": "台湾",
            "CNHK": "香港",
            "CNMO": "澳门"
        }

        # 加载目的地数据
        csv_path = os.path.join('static', 'assets', 'destinations.csv')
        df = pd.read_csv(csv_path, encoding='GBK')

        # 加载省份数据，用于获取英文名称
        province_data_path = os.path.join('static', 'assets', 'province_data.csv')
        province_df = pd.read_csv(province_data_path, encoding='GBK')

        # 创建中文名称到英文名称的映射
        name_to_english = {}
        for _, row in province_df.iterrows():
            name_to_english[row['name']] = row['english_name']

        # 获取省份得分的前三名
        top_province_ids = sorted(province_scores.items(), key=lambda x: x[1], reverse=True)[:3]
        print("前三省份:", top_province_ids)

        # 构建推荐列表
        recommendations = []

        for province_id, score in top_province_ids:
            # 将地图ID转换为中文省份名称
            if province_id in map_id_to_province_name:
                province_name = map_id_to_province_name[province_id]
                print(f"将地图ID {province_id} 转换为省份名称 {province_name}")

                # 在destinations.csv中查找与中文省份名称匹配的目的地
                destination_row = df[df['id'] == province_name]

                if not destination_row.empty:
                    destination = destination_row.iloc[0]

                    # 获取该省份的英文名称
                    english_name = name_to_english.get(province_name, province_name)

                    recommendations.append({
                        'name': destination['name'],  # 中文名
                        'english_name': english_name,  # 英文名
                        'image': destination['image'],
                        'description': destination['description'],
                        'match': int(score)  # 匹配度已经在province_scores中计算好
                    })
                    print(f"找到匹配的目的地: {destination['name']}, 英文名: {english_name}")
                else:
                    print(f"在CSV中找不到省份 {province_name} 的记录")
            else:
                print(f"找不到地图ID {province_id} 对应的中文省份名称")

        # 如果没有足够的推荐（少于3个），添加默认值
        default_destinations = [
            {
                'name': '北京',
                'english_name': 'Beijing',
                'image': 'static/images/destinations/Beijing.jpg',
                'description': '中国首都，拥有丰富的历史文化。',
                'match': 85
            },
            {
                'name': '上海',
                'english_name': 'Shanghai',
                'image': 'static/images/destinations/Shanghai.jpg',
                'description': '现代化国际都市。',
                'match': 80
            },
            {
                'name': '西安',
                'english_name': 'Xian',
                'image': 'static/images/destinations/Xian.jpg',
                'description': '古都，拥有众多历史遗迹。',
                'match': 75
            }
        ]

        # 添加默认目的地直到有3个推荐
        for i in range(3 - len(recommendations)):
            if i < len(default_destinations):
                recommendations.append(default_destinations[i])

        print("最终推荐列表:", recommendations)
        return recommendations

    except Exception as e:
        print(f"计算顶级目的地时出错: {str(e)}")
        import traceback
        traceback.print_exc()

        # 出错时返回默认推荐
        return [
            {
                'name': '北京',
                'english_name': 'Beijing',
                'image': 'static/images/destinations/Beijing.jpg',
                'description': '中国首都，拥有丰富的历史文化。',
                'match': 85
            },
            {
                'name': '上海',
                'english_name': 'Shanghai',
                'image': 'static/images/destinations/Shanghai.jpg',
                'description': '现代化国际都市。',
                'match': 80
            },
            {
                'name': '西安',
                'english_name': 'Xian',
                'image': 'static/images/destinations/Xian.jpg',
                'description': '古都，拥有众多历史遗迹。',
                'match': 75
            }
        ]

@app.route('/clear_session')
def clear_session():
    """清除会话数据"""
    session.clear()
    return redirect(url_for('home'))

@app.route('/debug_session')
def debug_session():
    """调试会话数据"""
    return jsonify(dict(session))


@app.route('/province/<province_name>')
def province_detail(province_name):
    """省份详情页面"""
    try:
        print(f"访问省份详情页: {province_name}")

        # 加载 province_data.csv
        csv_path = os.path.join('static', 'assets', 'province_data.csv')
        province_df = pd.read_csv(csv_path, encoding='GBK')

        # 根据英文名称查找省份信息
        province_data = province_df[province_df['english_name'] == province_name]

        if province_data.empty:
            print(f"在province_data.csv中未找到省份: {province_name}")
            return redirect(url_for('home'))

        province = province_data.iloc[0]
        province_id = province['id']  # 获取省份ID用于查找景点

        # 映射到省份页面需要的格式
        province_dict = {
            'id': province['id'],
            'name': province['name'],
            'english_name': province['english_name'],
            'banner_image': province['banner_image'],
            'description': province['description'],
            'map_id': province['map_id'] if 'map_id' in province else get_map_id_for_province(province['id'])
        }

        # 加载景点数据
        attractions_csv_path = os.path.join('static', 'assets', 'attraction_data.csv')

        try:
            attractions_df = pd.read_csv(attractions_csv_path, encoding='utf-8')
        except UnicodeDecodeError:
            # 如果UTF-8解码失败，尝试其他编码
            attractions_df = pd.read_csv(attractions_csv_path, encoding='gbk')

        # 根据省份ID筛选景点
        province_attractions = attractions_df[attractions_df['province_id'] == province_id]

        # 如果找到该省份的景点
        attractions = []
        if not province_attractions.empty:
            for _, attraction in province_attractions.iterrows():
                attractions.append({
                    'province_id': attraction['province_id'],
                    'attraction_name': attraction['attraction_name'],
                    'english_name': attraction['english_name'],
                    'image': attraction['image'],
                    'description': attraction['description']
                })
            print(f"从CSV加载了{len(attractions)}个景点")
        else:
            print(f"未找到省份{province_id}的景点记录，使用默认景点")
            # 如果没有找到该省份的景点，使用默认景点
            attractions = [
                {
                    'province_id': province_id,
                    'attraction_name': f'{province_dict["name"]}景点1',
                    'english_name': f'{province_name} Attraction 1',
                    'image': 'default_attraction.jpg',
                    'description': 'A popular tourist attraction in this province.'
                },
                {
                    'province_id': province_id,
                    'attraction_name': f'{province_dict["name"]}景点2',
                    'english_name': f'{province_name} Attraction 2',
                    'image': 'default_attraction.jpg',
                    'description': 'Another famous site with cultural significance.'
                },
                {
                    'province_id': province_id,
                    'attraction_name': f'{province_dict["name"]}景点3',
                    'english_name': f'{province_name} Attraction 3',
                    'image': 'default_attraction.jpg',
                    'description': 'A natural wonder in this beautiful province.'
                }
            ]

        # 获取省份地图数据
        map_data = get_province_map_data(province_dict['map_id'])

        return render_template(
            'province.html',
            province=province_dict,
            attractions=attractions,
            map_data=json.dumps(map_data) if map_data else None
        )
    except Exception as e:
        print(f"处理省份详情页时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return redirect(url_for('home'))


def get_map_id_for_province(province_id):
    """根据省份ID获取地图ID"""
    province_to_map_id = {
        "北京": "CNBJ",
        "天津": "CNTJ",
        "河北": "CNHE",
        "山西": "CNSX",
        "内蒙古": "CNMN",
        "辽宁": "CNLN",
        "吉林": "CNJL",
        "黑龙江": "CNHL",
        "上海": "CNSH",
        "江苏": "CNJS",
        "浙江": "CNZJ",
        "安徽": "CNAH",
        "福建": "CNFJ",
        "江西": "CNJX",
        "山东": "CNSD",
        "河南": "CNHA",
        "湖北": "CNHB",
        "湖南": "CNHN",
        "广东": "CNGD",
        "广西": "CNGX",
        "海南": "CNHI",
        "重庆": "CNCQ",
        "四川": "CNSC",
        "贵州": "CNGZ",
        "云南": "CNYN",
        "西藏": "CNXZ",
        "陕西": "CNSN",
        "甘肃": "CNGS",
        "青海": "CNQH",
        "宁夏": "CNNX",
        "新疆": "CNXJ"
    }
    return province_to_map_id.get(province_id, "CNBJ")  # 默认返回北京的ID


def get_province_map_data(map_id):
    """获取省份地图数据"""
    try:
        map_path = os.path.join('static', 'assets', 'cn.json')

        with open(map_path, 'r', encoding='utf-8') as f:
            china_map = json.load(f)

        # 查找该省份的地图数据
        for feature in china_map.get('features', []):
            if feature.get('properties', {}).get('id') == map_id:
                return feature

        return None
    except Exception as e:
        print(f"获取地图数据出错: {str(e)}")
        return None


@app.route('/destinations')
def destinations():
    """目的地页面"""
    try:
        # 加载目的地数据
        csv_path = os.path.join('static', 'assets', 'destinations.csv')
        df = pd.read_csv(csv_path, encoding='GBK')

        # 加载省份数据，用于获取英文名称
        province_data_path = os.path.join('static', 'assets', 'province_data.csv')
        province_df = pd.read_csv(province_data_path, encoding='GBK')

        # 创建中文名称到英文名称的映射
        name_to_english = {}
        for _, row in province_df.iterrows():
            name_to_english[row['name']] = row['english_name']

        # 加载偏好数据，用于标签筛选
        preferences_path = os.path.join('static', 'assets', 'cdata.csv')
        pref_df = pd.read_csv(preferences_path, encoding='gbk')

        # 获取所有可筛选的标签（除了'id'列之外的所有列）
        all_tags = [col for col in pref_df.columns if col != 'id']

        # 为每个标签创建一个安全的ID (用于HTML属性)
        tag_to_id = {}
        for i, tag in enumerate(all_tags):
            # 创建安全的标签ID，替换特殊字符和空格
            safe_id = f"tag_{i}"
            tag_to_id[tag] = safe_id

        # 构建目的地列表
        destinations_list = []
        for _, dest in df.iterrows():
            province_name = dest['id']

            # 获取该省份的英文名称
            english_name = name_to_english.get(province_name, province_name)

            # 获取该省份的标签列表
            province_tags = []
            province_tag_ids = []  # 存储安全的标签ID

            province_row = pref_df[pref_df['id'] == province_name]
            if not province_row.empty:
                for tag in all_tags:
                    try:
                        score = float(province_row[tag].values[0])
                        # 如果得分大于7，认为该标签适用于这个省份
                        if score > 70:
                            province_tags.append(tag)  # 原始标签名
                            province_tag_ids.append(tag_to_id[tag])  # 安全的标签ID
                    except (ValueError, TypeError, IndexError):
                        # 处理可能的错误
                        continue

            # 打印调试信息
            print(f"省份: {province_name}, 标签IDs: {province_tag_ids}")

            destinations_list.append({
                'id': province_name,
                'name': dest['name'],
                'english_name': english_name,
                'image': dest['image'],
                'description': dest['description'],
                'tags': province_tags,  # 原始标签名（用于显示）
                'tag_ids': province_tag_ids  # 安全的标签ID（用于筛选）
            })

        return render_template(
            'destinations.html',
            destinations=destinations_list,
            all_tags=all_tags,
            tag_to_id=tag_to_id
        )
    except Exception as e:
        print(f"获取目的地数据时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return redirect(url_for('home'))


@app.route('/plan')
def plan():
    """Travel planning page"""
    try:
        import pandas as pd
        import os

        # 加载省份数据，获取所有34个省份
        province_data_path = os.path.join('static', 'assets', 'province_data.csv')
        province_df = pd.read_csv(province_data_path, encoding='GBK')

        # 创建所有省份的列表，按英文名称排序
        all_provinces = []
        for _, row in province_df.iterrows():
            all_provinces.append({
                'province_id': row['id'],  # 中文省份名
                'english_name': row['english_name'],  # 英文省份名
                'chinese_name': row['name']  # 中文显示名
            })

        # 按英文名称排序
        all_provinces.sort(key=lambda x: x['english_name'])

        return render_template(
            'plan.html',
            recommended_destinations=all_provinces  # 传递所有省份而不是推荐的6个
        )

    except Exception as e:
        print(f"Error rendering plan page: {str(e)}")
        import traceback
        traceback.print_exc()
        return redirect(url_for('home'))


@app.route('/api/attractions')
def get_attractions():
    """API endpoint to retrieve attractions for a province"""
    try:
        import pandas as pd
        import os

        province_id = request.args.get('province_id')
        if not province_id:
            return jsonify({'error': 'Missing province_id parameter'}), 400

        # Load attractions data from CSV
        csv_path = os.path.join('static', 'assets', 'plan_data.csv')
        try:
            df = pd.read_csv(csv_path, encoding='gbk')
        except UnicodeDecodeError:
            # If GBK fails, try other encodings
            df = pd.read_csv(csv_path, encoding='iso-8859-1')

        # Filter attractions for this province
        province_attractions = df[df['province_id'] == province_id]

        if province_attractions.empty:
            return jsonify([]), 200

        # Convert to list of dictionaries
        result = []
        for _, row in province_attractions.iterrows():
            attraction = {
                'id': f"{row['province_id']}-{row['english_name']}",
                'province_id': row['province_id'],
                'attraction_name': row['attraction_name'],
                'english_name': row['english_name'],
                'people': int(row['people']),
                'budget': int(row['budget']),
                'time': float(row['time']),
                'type': row['type'],
            }
            result.append(attraction)

        return jsonify(result), 200

    except Exception as e:
        print(f"Error fetching attractions: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to retrieve attractions'}), 500

if __name__ == '__main__':
    app.run(debug=True)