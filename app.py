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

        # 打印CSV的列名以进行调试
        print("目的地CSV列名:", df.columns.tolist())
        print("CSV前两行:", df.head(2).to_dict('records'))

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
                    recommendations.append({
                        'name': destination['name'],
                        'image': destination['image'],
                        'description': destination['description'],
                        'match': int(score)  # 匹配度已经在province_scores中计算好
                    })
                    print(f"找到匹配的目的地: {destination['name']}")
                else:
                    print(f"在CSV中找不到省份 {province_name} 的记录")
            else:
                print(f"找不到地图ID {province_id} 对应的中文省份名称")

        # 如果没有足够的推荐（少于3个），添加默认值
        default_destinations = [
            {
                'name': '北京',
                'image': 'beijing.jpg',
                'description': '中国首都，拥有丰富的历史文化。',
                'match': 85
            },
            {
                'name': '上海',
                'image': 'shanghai.jpg',
                'description': '现代化国际都市。',
                'match': 80
            },
            {
                'name': '西安',
                'image': 'xian.jpg',
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
                'image': 'beijing.jpg',
                'description': '中国首都，拥有丰富的历史文化。',
                'match': 85
            },
            {
                'name': '上海',
                'image': 'shanghai.jpg',
                'description': '现代化国际都市。',
                'match': 80
            },
            {
                'name': '西安',
                'image': 'xian.jpg',
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

if __name__ == '__main__':
    app.run(debug=True)