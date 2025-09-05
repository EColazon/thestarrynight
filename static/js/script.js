document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const audioPlayer = document.getElementById('audio-player');
    const playBtn = document.getElementById('play-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const progressBar = document.getElementById('progress-bar');
    const progress = document.getElementById('progress');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalTimeDisplay = document.getElementById('total-time');
    const songTitle = document.getElementById('song-title');
    const songAlbum = document.getElementById('song-album');
    const playlistElement = document.getElementById('playlist');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeIcon = document.getElementById('volume-icon');
    const coverImage = document.getElementById('cover-image').parentElement;
    const lyricsContainer = document.getElementById('lyrics');
    const albumsContainer = document.getElementById('albums-container');
    const currentAlbumTitle = document.getElementById('current-album-title');

    // 状态变量
    let albums = [];
    let currentAlbum = '全部歌曲';
    let songs = [];
    let currentSongIndex = 0;
    let isShuffling = false;
    let isRepeating = false;
    let shuffledIndices = [];
    let lyrics = [];
    let currentLyricIndex = -1;

    // 初始化
    fetch('/api/albums')
        .then(response => response.json())
        .then(data => {
            albums = data;
            createAlbumsDisplay();

            // 加载第一个专辑
            if (albums.length > 0) {
                loadAlbum(albums[0].name);
            }
        })
        .catch(error => console.error('获取专辑列表失败:', error));

    // 创建专辑展示（底部，一行最多3个）
    function createAlbumsDisplay() {
        albumsContainer.innerHTML = '';

        // 添加专辑标题
        const albumsHeader = document.createElement('h2');
        albumsHeader.className = 'albums-header';
        albumsHeader.textContent = '专辑';
        albumsContainer.appendChild(albumsHeader);

        // 创建专辑网格容器
        const albumsGrid = document.createElement('div');
        albumsGrid.className = 'albums-grid';
        albumsContainer.appendChild(albumsGrid);

        albums.forEach(album => {
            const albumElement = document.createElement('div');
            albumElement.className = `album-item ${album.name === currentAlbum ? 'active' : ''}`;

            // 专辑封面（使用专辑内的图片或默认图片）
            const albumCover = document.createElement('div');
            albumCover.className = 'album-cover';
            const coverImg = document.createElement('img');

            // 对于"全部歌曲"使用默认图片，其他专辑尝试加载专辑内的图片
            if (album.name === '全部歌曲') {
                coverImg.src = 'https://picsum.photos/300/300?random=0';
            } else {
                coverImg.src = `/album-cover/${encodeURIComponent(album.name)}`;
            }

            coverImg.alt = `${album.name} 专辑封面`;
            // 图片加载失败时使用备用图片
            coverImg.onerror = function() {
                this.src = `https://picsum.photos/300/300?random=${album.name.hashCode()}`;
            };

            albumCover.appendChild(coverImg);

            // 专辑信息
            const albumInfo = document.createElement('div');
            albumInfo.className = 'album-info';

            const albumName = document.createElement('h3');
            albumName.textContent = album.name;

            const songCount = document.createElement('p');
            songCount.textContent = `${album.song_count} 首歌曲`;

            albumInfo.appendChild(albumName);
            albumInfo.appendChild(songCount);

            albumElement.appendChild(albumCover);
            albumElement.appendChild(albumInfo);

            // 点击切换专辑
            albumElement.addEventListener('click', () => {
                loadAlbum(album.name);
            });

            albumsGrid.appendChild(albumElement);
        });
    }

    // 加载专辑歌曲
    function loadAlbum(albumName) {
        currentAlbum = albumName;
        currentAlbumTitle.textContent = `${albumName} 歌曲`;

        // 更新专辑选中状态
        document.querySelectorAll('.album-item').forEach(item => {
            item.classList.toggle('active', item.querySelector('h3').textContent === albumName);
        });

        // 获取专辑歌曲
        fetch(`/api/albums/${encodeURIComponent(albumName)}`)
            .then(response => {
                if (!response.ok) throw new Error('专辑未找到');
                return response.json();
            })
            .then(data => {
                songs = data;
                currentSongIndex = 0;
                shuffledIndices = [];

                createPlaylist();

                // 如果有歌曲，加载第一首
                if (songs.length > 0) {
                    loadSong(0);
                } else {
                    // 清空播放器状态
                    songTitle.textContent = '无歌曲';
                    songAlbum.textContent = '--';
                    lyricsContainer.innerHTML = '<p>该专辑没有歌曲</p>';
                    coverImage.querySelector('img').src = 'https://picsum.photos/400/400?random=0';
                    audioPlayer.src = '';
                    updatePlayButton();
                }
            })
            .catch(error => {
                console.error('加载专辑失败:', error);
                lyricsContainer.innerHTML = '<p>加载专辑失败</p>';
            });
    }

    // 创建播放列表
    function createPlaylist() {
        playlistElement.innerHTML = '';

        songs.forEach((song, index) => {
            const li = document.createElement('li');

            const songNameSpan = document.createElement('span');
            songNameSpan.textContent = song.name;

            const hasLyricsSpan = document.createElement('span');
            hasLyricsSpan.className = 'has-lyrics';
            hasLyricsSpan.textContent = song.has_lyrics ? '♪' : '';

            li.appendChild(songNameSpan);
            li.appendChild(hasLyricsSpan);
            li.addEventListener('click', () => loadSong(index));

            playlistElement.appendChild(li);
        });
    }

    // 加载歌曲
    function loadSong(index) {
        if (index < 0 || index >= songs.length) return;

        currentSongIndex = index;
        const song = songs[currentSongIndex];
        audioPlayer.src = `/music/${encodeURIComponent(song.file)}`;
        songTitle.textContent = song.name;
        songAlbum.textContent = song.album;

        // 重置歌词
        lyrics = [];
        currentLyricIndex = -1;
        lyricsContainer.innerHTML = '<p>加载歌词中...</p>';

        // 如果有歌词，加载歌词
        if (song.has_lyrics) {
            fetch(`/lyrics/${encodeURIComponent(song.file)}`)
                .then(response => {
                    if (!response.ok) throw new Error('歌词未找到');
                    return response.text();
                })
                .then(text => {
                    lyrics = parseLRC(text);
                    if (lyrics.length === 0) {
                        lyricsContainer.innerHTML = '<p>没有找到有效歌词</p>';
                    } else {
                        updateLyricsDisplay();
                    }
                })
                .catch(error => {
                    console.error('加载歌词失败:', error);
                    lyricsContainer.innerHTML = '<p>无法加载歌词</p>';
                });
        } else {
            lyricsContainer.innerHTML = '<p>此歌曲没有歌词</p>';
        }

        // 更新活跃的播放列表项
        updateActivePlaylistItem();

        // 更改专辑封面
        const coverImg = coverImage.querySelector('img');
        if (song.album === '全部歌曲') {
            coverImg.src = `https://picsum.photos/400/400?random=${song.name.hashCode()}`;
        } else {
            coverImg.src = `/album-cover/${encodeURIComponent(song.album)}`;
            coverImg.onerror = function() {
                this.src = `https://picsum.photos/400/400?random=${song.album.hashCode()}`;
            };
        }

        // 播放歌曲
        audioPlayer.play()
            .then(() => {
                updatePlayButton();
                coverImage.classList.add('playing');
            })
            .catch(error => console.error('播放失败:', error));
    }

    // 解析LRC歌词
    function parseLRC(lrcText) {
        const lines = lrcText.split('\n');
        const lyrics = [];

        // 匹配时间标签的正则表达式 [mm:ss.xx]
        const timeRegex = /\[(\d+):(\d+\.\d+)\]/;

        lines.forEach(line => {
            const match = line.match(timeRegex);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseFloat(match[2]);
                const time = minutes * 60 + seconds;
                const text = line.replace(timeRegex, '').trim();

                if (text) {
                    lyrics.push({ time, text });
                }
            }
        });

        // 按时间排序
        return lyrics.sort((a, b) => a.time - b.time);
    }

    // 更新歌词显示
    function updateLyricsDisplay() {
        if (lyrics.length === 0) return;

        let html = '';
        lyrics.forEach((lyric, index) => {
            html += `<p class="${index === currentLyricIndex ? 'active' : ''}">${lyric.text}</p>`;
        });

        lyricsContainer.innerHTML = html;

        // 滚动到当前歌词
        if (currentLyricIndex !== -1) {
            const activeLyric = lyricsContainer.querySelector('p.active');
            if (activeLyric) {
                const containerHeight = lyricsContainer.clientHeight;
                const lyricHeight = activeLyric.clientHeight;
                const scrollPosition = activeLyric.offsetTop - (containerHeight / 2) + (lyricHeight / 2);
                lyricsContainer.scrollTop = scrollPosition;
            }
        }
    }

    // 更新活跃的播放列表项
    function updateActivePlaylistItem() {
        const items = playlistElement.querySelectorAll('li');
        items.forEach((item, index) => {
            if (index === currentSongIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // 播放/暂停切换
    playBtn.addEventListener('click', togglePlay);

    function togglePlay() {
        if (audioPlayer.paused) {
            audioPlayer.play();
            coverImage.classList.add('playing');
        } else {
            audioPlayer.pause();
            coverImage.classList.remove('playing');
        }
        updatePlayButton();
    }

    // 更新播放按钮图标
    function updatePlayButton() {
        const icon = playBtn.querySelector('i');
        if (audioPlayer.paused) {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        } else {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        }
    }

    // 上一首
    prevBtn.addEventListener('click', () => {
        let index;

        if (isShuffling && shuffledIndices.length > 0) {
            const currentPos = shuffledIndices.indexOf(currentSongIndex);
            index = currentPos > 0 ? shuffledIndices[currentPos - 1] : shuffledIndices[shuffledIndices.length - 1];
        } else {
            index = currentSongIndex > 0 ? currentSongIndex - 1 : songs.length - 1;
        }

        loadSong(index);
    });

    // 下一首
    nextBtn.addEventListener('click', () => {
        playNextSong();
    });

    // 播放下一首
    function playNextSong() {
        if (songs.length === 0) return;

        let index;

        if (isShuffling) {
            if (shuffledIndices.length === 0) {
                // 初始化随机播放列表
                shuffledIndices = [...Array(songs.length).keys()];
                shuffleArray(shuffledIndices);
            }

            const currentPos = shuffledIndices.indexOf(currentSongIndex);
            index = currentPos < shuffledIndices.length - 1 ? shuffledIndices[currentPos + 1] : shuffledIndices[0];
        } else {
            index = (currentSongIndex + 1) % songs.length;
        }

        loadSong(index);
    }

    // 随机播放切换
    shuffleBtn.addEventListener('click', () => {
        isShuffling = !isShuffling;
        shuffleBtn.classList.toggle('active', isShuffling);

        if (isShuffling) {
            // 初始化随机播放列表
            shuffledIndices = [...Array(songs.length).keys()];
            shuffleArray(shuffledIndices);
        }
    });

    // 重复播放切换
    repeatBtn.addEventListener('click', () => {
        isRepeating = !isRepeating;
        repeatBtn.classList.toggle('active', isRepeating);
        audioPlayer.loop = isRepeating;
    });

    // 进度条更新
    audioPlayer.addEventListener('timeupdate', updateProgress);

    function updateProgress() {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progress.style.width = `${percent}%`;

        // 更新时间显示
        currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
        totalTimeDisplay.textContent = formatTime(audioPlayer.duration);

        // 更新歌词
        updateCurrentLyric();
    }

    // 更新当前歌词
    function updateCurrentLyric() {
        if (lyrics.length === 0) return;

        const currentTime = audioPlayer.currentTime;

        // 找到当前应该显示的歌词
        for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time > currentTime) {
                const newIndex = i - 1;
                if (newIndex !== currentLyricIndex) {
                    currentLyricIndex = newIndex;
                    updateLyricsDisplay();
                }
                return;
            }
        }

        // 如果所有歌词都已显示
        if (currentLyricIndex !== lyrics.length - 1) {
            currentLyricIndex = lyrics.length - 1;
            updateLyricsDisplay();
        }
    }

    // 格式化时间（秒 -> mm:ss）
    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 点击进度条跳转
    progressBar.addEventListener('click', seek);

    function seek(e) {
        const seekTime = (e.offsetX / progressBar.clientWidth) * audioPlayer.duration;
        audioPlayer.currentTime = seekTime;
    }

    // 音量控制
    volumeSlider.addEventListener('input', updateVolume);

    function updateVolume() {
        audioPlayer.volume = volumeSlider.value;
        updateVolumeIcon();
    }

    // 更新音量图标
    function updateVolumeIcon() {
        const volume = audioPlayer.volume;
        volumeIcon.className = '';

        if (volume === 0) {
            volumeIcon.classList.add('fas', 'fa-volume-mute');
        } else if (volume < 0.5) {
            volumeIcon.classList.add('fas', 'fa-volume-down');
        } else {
            volumeIcon.classList.add('fas', 'fa-volume-up');
        }
    }

    // 歌曲结束时自动播放下一首
    audioPlayer.addEventListener('ended', () => {
        if (!isRepeating) {
            playNextSong();
        } else {
            // 如果是单曲循环，重新播放当前歌曲
            audioPlayer.currentTime = 0;
            audioPlayer.play();
        }
    });

    // 随机打乱数组
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 为字符串添加hashCode方法，用于生成一致的随机图片
    String.prototype.hashCode = function() {
        let hash = 0;
        for (let i = 0; i < this.length; i++) {
            const char = this.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    };

    // 初始化音量
    updateVolume();
});
