from flask import Flask, render_template, jsonify, send_from_directory
import os
from urllib.parse import unquote  # 导入URL解码模块

app = Flask(__name__)

# 配置目录路径
MUSIC_FOLDER = os.path.join(app.root_path, 'static', 'music')
LYRICS_FOLDER = os.path.join(app.root_path, 'static', 'lyrics')
STATIC_FOLDER = os.path.join(app.root_path, 'static')
app.config['MUSIC_FOLDER'] = MUSIC_FOLDER
app.config['LYRICS_FOLDER'] = LYRICS_FOLDER

# 支持的音频格式
SUPPORTED_FORMATS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg']
# 支持的图片格式（用于专辑封面）
SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif']

# 确保目录存在
for folder in [MUSIC_FOLDER, LYRICS_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)


@app.route('/')
def index():
    """首页路由"""
    return render_template('index.html')


@app.route('/music/<path:filename>')
def get_music(filename):
    """提供音乐文件，支持专辑子目录"""
    try:
        # 解码URL编码的字符（关键修复）
        filename = unquote(filename)
        # 将URL中的正斜杠转换为系统对应的斜杠
        filename = filename.replace('/', os.sep)
        # 检查文件是否存在
        full_path = os.path.join(app.config['MUSIC_FOLDER'], filename)
        if not os.path.exists(full_path):
            return f"文件不存在: {full_path}", 404
        return send_from_directory(app.config['MUSIC_FOLDER'], filename)
    except Exception as e:
        return f"处理文件时出错: {str(e)}", 500


@app.route('/album-cover/<album_name>')
def get_album_cover(album_name):
    """获取专辑封面图片"""
    try:
        album_name = unquote(album_name)  # 解码URL
        album_path = os.path.join(app.config['MUSIC_FOLDER'], album_name)
        if not os.path.isdir(album_path):
            return send_from_directory(STATIC_FOLDER, 'default-cover.jpg')

        # 查找专辑目录中的图片文件
        for file in os.listdir(album_path):
            if any(file.lower().endswith(ext) for ext in SUPPORTED_IMAGE_FORMATS):
                return send_from_directory(album_path, file)

        # 如果没有找到图片，返回默认封面
        return send_from_directory(STATIC_FOLDER, 'default-cover.jpg')
    except Exception as e:
        return f"处理封面时出错: {str(e)}", 500


@app.route('/lyrics/<filename>')
def get_lyrics(filename):
    """提供歌词文件"""
    try:
        filename = unquote(filename)  # 解码URL
        # 替换扩展名获取歌词文件
        base_name = os.path.splitext(filename)[0]
        # 处理路径分隔符
        base_name = base_name.replace('/', os.sep)
        lyrics_file = f"{base_name}.lrc"
        lyrics_path = os.path.join(app.config['LYRICS_FOLDER'], lyrics_file)

        if os.path.exists(lyrics_path):
            return send_from_directory(app.config['LYRICS_FOLDER'], lyrics_file)
        return jsonify({"error": "Lyrics not found"}), 404
    except Exception as e:
        return f"处理歌词时出错: {str(e)}", 500


@app.route('/api/albums')
def get_albums():
    """获取所有专辑列表"""
    albums = []

    # 遍历music目录下的所有子目录作为专辑
    for item in os.listdir(app.config['MUSIC_FOLDER']):
        item_path = os.path.join(app.config['MUSIC_FOLDER'], item)
        if os.path.isdir(item_path):
            # 统计专辑中的歌曲数量
            song_count = 0
            for file in os.listdir(item_path):
                if any(file.endswith(ext) for ext in SUPPORTED_FORMATS):
                    song_count += 1

            if song_count > 0:
                albums.append({
                    'name': item,
                    'song_count': song_count
                })

    # 添加"全部歌曲"虚拟专辑
    albums.insert(0, {
        'name': '全部歌曲',
        'song_count': get_total_song_count()
    })

    return jsonify(albums)


@app.route('/api/albums/<album_name>')
def get_album_songs(album_name):
    """获取指定专辑的歌曲列表"""
    try:
        album_name = unquote(album_name)  # 解码URL
        songs = []

        if album_name == '全部歌曲':
            # 获取所有专辑的所有歌曲
            return get_all_songs()

        album_path = os.path.join(app.config['MUSIC_FOLDER'], album_name)
        if not os.path.isdir(album_path):
            return jsonify({"error": "Album not found"}), 404

        # 遍历专辑目录中的歌曲
        for filename in os.listdir(album_path):
            if any(filename.endswith(ext) for ext in SUPPORTED_FORMATS):
                song_name = os.path.splitext(filename)[0]
                # 使用正斜杠作为路径分隔符
                relative_path = os.path.join(album_name, filename).replace(os.sep, '/')

                # 检查是否有对应的歌词文件
                has_lyrics = os.path.exists(os.path.join(LYRICS_FOLDER, f"{song_name}.lrc"))

                songs.append({
                    'name': song_name,
                    'file': relative_path,
                    'album': album_name,
                    'has_lyrics': has_lyrics
                })

        return jsonify(songs)
    except Exception as e:
        return jsonify({"error": f"处理专辑时出错: {str(e)}"}), 500


def get_all_songs():
    """获取所有歌曲"""
    all_songs = []

    # 遍历所有专辑目录
    for album in os.listdir(app.config['MUSIC_FOLDER']):
        album_path = os.path.join(app.config['MUSIC_FOLDER'], album)
        if os.path.isdir(album_path):
            # 遍历专辑中的歌曲
            for filename in os.listdir(album_path):
                if any(filename.endswith(ext) for ext in SUPPORTED_FORMATS):
                    song_name = os.path.splitext(filename)[0]
                    # 使用正斜杠作为路径分隔符
                    relative_path = os.path.join(album, filename).replace(os.sep, '/')

                    has_lyrics = os.path.exists(os.path.join(LYRICS_FOLDER, f"{song_name}.lrc"))

                    all_songs.append({
                        'name': song_name,
                        'file': relative_path,
                        'album': album,
                        'has_lyrics': has_lyrics
                    })

    return jsonify(all_songs)


def get_total_song_count():
    """获取总歌曲数量"""
    count = 0

    for album in os.listdir(app.config['MUSIC_FOLDER']):
        album_path = os.path.join(app.config['MUSIC_FOLDER'], album)
        if os.path.isdir(album_path):
            for filename in os.listdir(album_path):
                if any(filename.endswith(ext) for ext in SUPPORTED_FORMATS):
                    count += 1

    return count


if __name__ == '__main__':
    #app.run(debug=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
