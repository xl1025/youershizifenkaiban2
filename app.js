
    // ==================== 全局变量 ====================
    let baseWriter = null;       // 黑色笔顺动画 / 字形参考层
    let traceWriter = null;      // 蓝色手写描红层（持久，不被动画清除）
    let traceCompleted = false;  // 用户是否已写完（写完则保留蓝迹，不再重置）
    let traceQuizActive = false; // 描红测验是否进行中
    let lastMistakeSpeak = 0;    // 描红写错语音提示节流时间戳（避免连续误触反复播报）
    const TRACE_WIDTH = 4;            // 黑色参考字（范字）笔划粗细
    const TRACE_DRAW_WIDTH = 28;      // 蓝色手写描红笔迹粗细（现有值2倍，手动书写轨迹更明显、更易辨认）
    let tzgCenterTries = 0;           // 田字格居中重试计数（字形数据异步加载，最多重试若干次）
    // 田字格字形居中：HanziWriter 默认按“字身框(em box)”居中，而 makemeahanzi 字库中部分汉字
    // 的墨迹框相对 em 框偏移（如“日”偏左上），导致字形落在田字格左上角。此处通过给两个田字格
    // SVG 设置 viewBox 把字形平移到正中。关键：必须改 SVG 的 viewBox（而非内层 <g> 的 transform）——
    // 因为 HanziWriter 用 svg.getScreenCTM() 做描红指针→字形坐标映射，改 viewBox 会被 getScreenCTM
    // 包含，从而保证“蓝色手写轨迹”与“黑色参考字”始终对齐、不错位。
    function applyTzgCentering(isFollowup) {
        if (typeof HanziWriter === 'undefined') return;           // 字库未加载则无需重试
        const base = document.getElementById('tzg-base');
        const trace = document.getElementById('tzg-trace');
        const svg = base && base.querySelector('svg');
        if (!svg) { if (tzgCenterTries++ < 50) setTimeout(() => applyTzgCentering(false), 120); return; }
        const g = svg.querySelector('g');                          // 含字形（轮廓+字+高亮）的定位组
        if (!g) { if (tzgCenterTries++ < 50) setTimeout(() => applyTzgCentering(false), 120); return; }
        const paths = Array.from(svg.querySelectorAll('path')).filter(p => !p.closest('defs'));
        if (paths.length === 0) { if (tzgCenterTries++ < 50) setTimeout(() => applyTzgCentering(false), 120); return; }  // 字形数据尚未异步加载完
        tzgCenterTries = 0;
        const size = parseFloat(svg.getAttribute('width')) || 190; // 桌面 190 / 移动 160（与 HanziWriter 创建尺寸一致）
        // 暂移除 viewBox（若有）以测量“未校正”字形位置，保证幂等可重复调用
        svg.removeAttribute('viewBox');
        const traceSvg = trace && trace.querySelector('svg');
        if (traceSvg) traceSvg.removeAttribute('viewBox');
        // 字形中心（SVG 用户坐标系）：用 getBBox + 组变换矩阵求得。该值仅取决于字形几何与
        // HanziWriter 的组变换，与 CSS 布局 / 翻面 3D 动画无关，故测量稳定、不会因动画而失真。
        // （注意：不能用 getBoundingClientRect 反推——那量的是“无 viewBox 渲染模式”下的屏幕位置，
        //  与设置 viewBox 后的映射不一致，会导致偏移计算错误。）
        const bb = g.getBBox();
        const bx = bb.x + bb.width / 2, by = bb.y + bb.height / 2;
        const tv = g.transform.baseVal;
        const m = tv && tv.numberOfItems ? tv.consolidate().matrix : null;
        let gx, gy;
        if (m) { const tp = new DOMPoint(bx, by).matrixTransform(m); gx = tp.x; gy = tp.y; }
        else { // 兜底：屏幕包围盒（仍受布局影响，仅作保险）
          const sr = svg.getBoundingClientRect(), gr = g.getBoundingClientRect();
          const k = size / sr.width;
          gx = (gr.left + gr.width / 2 - sr.left) * k; gy = (gr.top + gr.height / 2 - sr.top) * k;
        }
        const vx = (gx - size / 2).toFixed(2);
        const vy = (gy - size / 2).toFixed(2);
        const vb = vx + ' ' + vy + ' ' + size + ' ' + size;
        svg.setAttribute('viewBox', vb);
        if (traceSvg) traceSvg.setAttribute('viewBox', vb);       // 同步，保持两层对齐（描红手写与参考字对齐）
        // 翻面 3D 动画期间首次调用若因时序异常，600ms 后动画结束再重测校正一次（仅调度一次，避免死循环）
        if (!isFollowup) setTimeout(() => applyTzgCentering(true), 600);
    }
    let threeScene = null;
    let currentCard = null;   // 当前打开的知识卡片数据
    let blendType = null;     // 拼读浮窗类型：null / 'pinyin' / 'english'（用于喇叭显隐切换）
    let topDrag = { x:0, y:0, dragging:false, sx:0, sy:0, ox:0, oy:0 };  // 顶部组拖动状态

    // ==================== 场景管理 ====================
    let currentScene = window.CURRENT_SCENE || 'nature';  // 当前场景：'nature'（自然元素）| 'zoo'（动物王国）
    const SCENE_CONFIG = {
        nature: { data: literacyData, bgSrc: '背景1.jpg', title: '🌿 自然元素探索之旅', cols: 5, speakPrefix: '自然元素' },
        zoo:    { data: zooData,     bgSrc: '背景图2.jpg', title: '🦁 动物王国探索之旅', cols: 6, speakPrefix: '动物朋友' }
    };

    // ==================== 初始化入口 ====================
    document.addEventListener('DOMContentLoaded', () => {
        // 部署资源自检：提前发现 libs/ 未上线等问题（GitHub Pages 上线后"田字格/讲解/描红失效"的首要排查项）
        try { verifyDeployAssets(); } catch (e) { /* 自检失败不影响主功能 */ }
        // 3D 背景（three.js，纯装饰）：仅桌面/非低端设备在空闲时本地加载，手机端跳过以省带宽、避免卡顿；
        // 加载失败或离线则回退纯色渐变背景，绝不阻塞主功能。
        try {
            const isTouch = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
            if (!isLowPerfDevice() && !isTouch) {
                const startThree = () => ensureThree(() => {
                    try { initThreeBackground(); } catch (e) { console.warn('3D 背景初始化失败（不影响主功能）：', e); }
                });
                if (window.requestIdleCallback) requestIdleCallback(startThree, { timeout: 4000 });
                else setTimeout(startThree, 600);
            }
        } catch (e) {
            console.warn('3D 背景调度失败（不影响主功能）：', e);
        }
        try {
            buildGrid();   // 默认使用 currentScene（='nature'）
            try { loadVoicePref(); } catch(e){}
            try { loadRatePref(); } catch(e){}
            try { populateVoicePanel(); } catch(e){}
            try { syncRateBtn(); } catch(e){}
            initTopDrag();
        } catch (e) {
            console.error('主场景初始化出错：', e);
        }
        // 无论初始化是否成功，都隐藏加载画面，避免永久卡在“正在准备…”状态
        setTimeout(() => {
            const loader = document.getElementById('loadingScreen');
            if (loader) {
                loader.classList.add('hide');
                setTimeout(() => { if (loader) loader.style.display = 'none'; }, 900);
            }
        }, 1200);
    });

    // 顶部组（核心字 + 拼音 + 英语 + 喇叭）拖动：按住拖动即可移动，点击按钮不触发拖动
    function initTopDrag(){
        const block = document.getElementById('topBlock');
        if (!block) return;
        block.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;   // 点击小喇叭等按钮时不拖动
            topDrag.pending = true;
            topDrag.dragging = false;
            topDrag.sx = e.clientX; topDrag.sy = e.clientY;
            topDrag.ox = topDrag.x;    topDrag.oy = topDrag.y;
            try { block.setPointerCapture(e.pointerId); } catch(err){}
        });
        block.addEventListener('pointermove', (e) => {
            if (!topDrag.pending && !topDrag.dragging) return;
            const dx = e.clientX - topDrag.sx;
            const dy = e.clientY - topDrag.sy;
            // 仅当移动超过阈值才判定为拖动，避免点击 / 轻微滑动误触发位移（移动端尤为重要）
            if (!topDrag.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) topDrag.dragging = true;
            if (topDrag.dragging) {
                topDrag.x = topDrag.ox + dx;
                topDrag.y = topDrag.oy + dy;
                block.style.transform = `translate(${topDrag.x}px, ${topDrag.y}px)`;
            }
        });
        const end = () => { topDrag.dragging = false; topDrag.pending = false; };
        block.addEventListener('pointerup', end);
        block.addEventListener('pointercancel', end);
    }

    // ==================== 本地依赖懒加载（全部同源 libs/，彻底去除 jsdelivr 外链） ====================
    // 动态注入 <script>，返回 Promise；失败仅告警、绝不阻塞主功能。
    const _failedAssets = [];   // 记录加载失败的依赖 URL，便于线上精准定位缺失文件
    window.__failedAssets = _failedAssets;
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src; s.async = true;
            s.onload = () => resolve();
            s.onerror = (e) => { console.warn('依赖加载失败：' + src, e); _failedAssets.push(src); reject(e); };
            document.head.appendChild(s);
        });
    }
    let _hwPromise = null;
    // HanziWriter + 本地笔画数据：首次开卡时加载（仅一次），随后书写/描红立即可用
    function ensureHanziWriter() {
        if (typeof HanziWriter !== 'undefined' && window.__HANZI_DATA__) return Promise.resolve();
        if (_hwPromise) return _hwPromise;
        const load = () => Promise.all([
            loadScript('libs/hanzi-data.js'),
            loadScript('libs/hanzi-writer.min.js')
        ]);
        // 首次失败自动重试一次（网络抖动 / 资源尚未就绪），仍失败则由调用方显示明确提示（不再静默失效）
        _hwPromise = load().catch((e) => {
            console.warn('HanziWriter 依赖首次加载失败，1.5s 后重试一次：', e);
            return new Promise((r) => setTimeout(r, 1500)).then(load);
        });
        return _hwPromise;
    }
    let _confettiPromise = null;
    function ensureConfetti() {
        if (typeof confetti !== 'undefined') return Promise.resolve();
        if (_confettiPromise) return _confettiPromise;
        _confettiPromise = loadScript('libs/confetti.min.js');
        return _confettiPromise;
    }
    let _threePromise = null;
    function ensureThree(onload) {
        if (typeof THREE !== 'undefined') { if (onload) onload(); return Promise.resolve(); }
        if (_threePromise) return _threePromise.then(() => { if (onload) onload(); });
        _threePromise = loadScript('libs/three.min.js');
        return _threePromise.then(() => { if (onload) onload(); });
    }

    // ==================== 部署资源自检（GitHub Pages 上线后精准定位缺失文件） ====================
    // 站点上线后若 libs/ 未真正推送到仓库，田字格/讲解/描红会静默失效。此函数在页面加载时
    // 主动探测 4 个本地依赖是否可达（同源 HEAD 请求，无跨域问题），缺失则顶部红色横幅列出具体文件。
    // 全部引用均为相对路径，天然兼容 GitHub Pages 子目录部署（username.github.io/仓库名/）。
    const _CRITICAL_ASSETS = [
        'libs/hanzi-writer.min.js',  // 田字格 / 讲解 / 描红 的核心引擎
        'libs/hanzi-data.js',        // 33 字笔画数据源（讲解/描红/田字格字形依赖）
        'libs/confetti.min.js',      // 通关彩带（装饰，缺失仅无彩带）
        'libs/three.min.js'          // 3D 粒子背景（装饰，缺失仅回退纯色背景）
    ];
    const _deployMissing = new Set();   // 累计缺失文件（多次调用合并去重）
    function showDeployWarning(missing) {
        const el = document.getElementById('deploy-warning');
        if (!el) return;
        // 合并去重：verifyDeployAssets 与 ensureHanziWriter 重试失败都会调用，避免重复条目
        missing.forEach(u => _deployMissing.add(u));
        if (!_deployMissing.size) return;
        const list = [..._deployMissing];
        // 给出每个缺失文件的“完整解析 URL”，用户可直接复制到浏览器查看真实 404 响应
        const urlOf = (u) => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
        el.innerHTML = '<span class="dw-close" title="关闭">×</span>' +
            '<strong>⚠️ 部署缺少资源文件（' + list.length + ' 个）</strong><br>' +
            '以下文件未加载成功（在浏览器打开下面链接即可看到 404）：<br>' +
            list.map(u => '<a href="' + urlOf(u) + '" target="_blank" rel="noopener" style="color:#ffd54f;word-break:break-all">' + urlOf(u) + '</a>').join('<br>') +
            '<br>这正导致「田字格不显示 / 讲解和描红无法运行」。请确认：<br>' +
            '① 这些文件已提交到 GitHub 仓库（与 index.html 同级，位于 <code>libs/</code> 目录）；<br>' +
            '② 仓库根目录的 <code>.gitignore</code> 没有排除 <code>libs/</code>、<code>*.min.js</code>、<code>*.js</code>（可用 <code>git check-ignore libs/hanzi-data.js</code> 验证，或 <code>git add -f libs/</code> 强制提交）；<br>' +
            '③ 若部署在子目录（如 <code>username.github.io/仓库名/</code>），请保持相对路径（当前已是，无需改）。';
        el.style.display = 'block';
        const closeBtn = el.querySelector('.dw-close');
        if (closeBtn) closeBtn.onclick = () => { el.style.display = 'none'; };
    }
    // 取实际加载失败的 libs（去重）；若尚无失败记录则回退到前两个核心依赖作为提示
    function criticalMissingHint() {
        const m = [...new Set(_failedAssets.filter(u => /libs\//.test(u)))];
        return m.length ? m : _CRITICAL_ASSETS.slice(0, 2);
    }
    // 单文件探测：先 HEAD，非 2xx 或 HEAD 不可用时再 GET 复核；两者都失败才判定缺失。
    // 原因：个别静态托管（或中间代理）对 HEAD 处理异常，只按 HEAD 判定会误报"缺失"。
    function checkAsset(u) {
        return fetch(u, { method: 'HEAD' })
            .then(r => (r.ok ? null : u), () => null)
            .then(miss => miss ? fetch(u).then(r => (r.ok ? null : u), () => null) : null);
    }
    function verifyDeployAssets() {
        Promise.all(_CRITICAL_ASSETS.map(checkAsset)).then(results => {
            const missing = results.filter(Boolean);
            if (missing.length) showDeployWarning(missing);
        }).catch(() => { /* 探针本身失败不干扰主功能 */ });
    }

    // ==================== Three.js 3D粒子背景 ====================
    function initThreeBackground() {
        if (threeScene) return;                        // 避免重复初始化（async 加载可能触发多次）
        if (typeof THREE === 'undefined') return;      // CDN 未就绪时直接跳过，回退纯色背景
        // 触屏/移动设备降低渲染负担，避免 iPad 等常驻重绘卡顿
        const isTouch = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
        const canvas = document.getElementById('three-canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1 : 2));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 50;

        threeScene = { scene, camera, renderer };

        // ---- 创建多种粒子系统 ----

        // 1. 金色萤火虫/星光粒子（主粒子）
        const fireflyCount = isTouch ? 40 : 120;
        const fireflyGeom = new THREE.BufferGeometry();
        const fireflyPos = new Float32Array(fireflyCount * 3);
        const fireflySizes = new Float32Array(fireflyCount);
        const fireflyPhases = new Float32Array(fireflyCount);

        for (let i = 0; i < fireflyCount; i++) {
            fireflyPos[i * 3]     = (Math.random() - 0.5) * 120;
            fireflyPos[i * 3 + 1] = (Math.random() - 0.5) * 70;
            fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10;
            fireflySizes[i] = Math.random() * 3 + 1.5;
            fireflyPhases[i] = Math.random() * Math.PI * 2;
        }
        fireflyGeom.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
        fireflyGeom.setAttribute('size', new THREE.BufferAttribute(fireflySizes, 1));

        const fireflyMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0xffd54f) }
            },
            vertexShader: `
                attribute float size;
                varying float vAlpha;
                uniform float uTime;
                void main() {
                    vec3 pos = position;
                    pos.y += sin(uTime * 0.8 + position.x * 0.1) * 2.0;
                    pos.x += cos(uTime * 0.5 + position.y * 0.08) * 1.5;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * (250.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                    vAlpha = 0.4 + 0.6 * sin(uTime * 2.0 + position.x + position.y);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float glow = 1.0 - smoothstep(0.0, 0.5, d);
                    glow = pow(glow, 1.5);
                    gl_FragColor = vec4(uColor, glow * vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const fireflies = new THREE.Points(fireflyGeom, fireflyMat);
        scene.add(fireflies);

        // 2. 彩色梦幻尘埃粒子
        const dustCount = isTouch ? 25 : 80;
        const dustGeom = new THREE.BufferGeometry();
        const dustPos = new Float32Array(dustCount * 3);
        const dustColors = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount; i++) {
            dustPos[i * 3]     = (Math.random() - 0.5) * 140;
            dustPos[i * 3 + 1] = (Math.random() - 0.5) * 80;
            dustPos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 15;
            // 随机柔和色彩
            const hue = Math.random();
            const color = new THREE.Color().setHSL(hue, 0.7, 0.65);
            dustColors[i * 3]     = color.r;
            dustColors[i * 3 + 1] = color.g;
            dustColors[i * 3 + 2] = color.b;
        }
        dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        dustGeom.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

        const dustMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
                attribute vec3 color;
                varying vec3 vColor;
                varying float vAlpha;
                uniform float uTime;
                void main() {
                    vColor = color;
                    vec3 pos = position;
                    pos.y += sin(uTime * 0.3 + position.z * 0.2) * 3.0;
                    pos.x += sin(uTime * 0.2 + position.y * 0.15) * 2.0;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = 2.5 * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                    vAlpha = 0.3 + 0.4 * sin(uTime * 1.5 + position.x * 0.1);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float alpha = (1.0 - d * 2.0) * vAlpha;
                    gl_FragColor = vec4(vColor, alpha * 0.6);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const dustParticles = new THREE.Points(dustGeom, dustMat);
        scene.add(dustParticles);

        // ---- 动画循环（可暂停：页面隐藏 / 弹窗打开时停止，移动端显著省电防卡顿） ----
        let threeRAF = null, threeActive = false, time = 0;
        function frame() {
            threeRAF = requestAnimationFrame(frame);
            time += 0.016;
            fireflyMat.uniforms.uTime.value = time;
            dustMat.uniforms.uTime.value = time;
            // 相机微微晃动
            camera.position.x = Math.sin(time * 0.15) * 2;
            camera.position.y = Math.cos(time * 0.12) * 1.5;
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
        }
        function startThree() { if (threeActive) return; threeActive = true; frame(); }
        function stopThree()  { threeActive = false; if (threeRAF) { cancelAnimationFrame(threeRAF); threeRAF = null; } }
        // 暴露控制句柄给弹窗开关
        window.__threeCtl = { start: startThree, stop: stopThree, isActive: () => threeActive };
        // 切到后台（切换 App / 锁屏）时暂停，回到前台恢复——避免常驻重绘拖慢设备
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopThree(); else startThree();
        });
        startThree();

        // ---- 响应窗口大小变化（防抖：避免 orientationchange/连续 resize 时反复重建 WebGL 缓冲） ----
        let threeResizeT = null;
        window.addEventListener('resize', () => {
            if (threeResizeT) clearTimeout(threeResizeT);
            threeResizeT = setTimeout(() => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }, 200);
        });
    }


    // ==================== 构建交互网格（场景感知） ====================
    function buildGrid(sceneId) {
        sceneId = sceneId || currentScene;
        const config = SCENE_CONFIG[sceneId];
        if (!config) { console.warn('未知场景:', sceneId); return; }
        const data = config.data;

        const gridOverlay = document.getElementById('gridOverlay');
        gridOverlay.innerHTML = '';  // 清空旧网格

        // 根据场景设置网格列数（自然元素5列/动物园6列）
        gridOverlay.classList.remove('cols-6');
        if (config.cols === 6) gridOverlay.classList.add('cols-6');

        data.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.dataset.index = index;

            // 点击事件：波纹效果 + 打开弹窗
            div.addEventListener('click', (e) => {
                createRipple(e, div);
                setTimeout(() => openModal(item), 200);
            });

            // 3D 倾斜跟随鼠标（用 rAF 节流，避免每次 mousemove 触发重排/重绘）
            let tiltScheduled = false, tiltX = 0, tiltY = 0;
            div.addEventListener('mouseenter', () => { div.style.willChange = 'transform'; });
            div.addEventListener('mousemove', (e) => {
                const rect = div.getBoundingClientRect();
                tiltX = ((e.clientY - rect.top - rect.height / 2) / rect.height) * -12;
                tiltY = ((e.clientX - rect.left - rect.width / 2) / rect.width) * 12;
                if (!tiltScheduled) {
                    tiltScheduled = true;
                    requestAnimationFrame(() => {
                        tiltScheduled = false;
                        div.style.transform = `scale(1.08) translateZ(20px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
                    });
                }
            });

            div.addEventListener('mouseleave', () => {
                div.style.transform = '';
                div.style.willChange = 'auto';
            });

            gridOverlay.appendChild(div);
        });
    }

    // ==================== 场景切换 ====================
    function switchScene(sceneId) {
        if (sceneId === currentScene) return;  // 已在该场景，跳过
        if (!SCENE_CONFIG[sceneId]) return;

        // 先关闭可能打开的弹窗
        closeModal();

        const config = SCENE_CONFIG[sceneId];
        currentScene = sceneId;

        // 1. 更新标签栏激活状态
        document.querySelectorAll('.scene-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.scene === sceneId);
        });

        // 2. 切换背景图
        const bgImg = document.querySelector('.main-bg');
        if (bgImg) bgImg.src = config.bgSrc;

        // 3. 重建网格（自动使用正确的数据和列数）
        buildGrid(sceneId);

        // 4. 更新标题
        const titleEl = document.querySelector('.title-decoration');
        if (titleEl) titleEl.textContent = config.title;

        // 4. 切换完成语音提示
        speakAudio(`欢迎来到${config.title}！`);
    }

    // 创建点击波纹效果
    function createRipple(e, element) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    // ==================== 设备性能检测（自适应媒体：视频 / 静图） ====================
    let __lowPerf = null;   // 惰性缓存判定结果，避免重复计算
    function isLowPerfDevice(){
        if (__lowPerf !== null) return __lowPerf;
        let low = false;
        try {
            const cores = navigator.hardwareConcurrency || 0;
            const mem = navigator.deviceMemory || 0;
            if (cores && cores <= 2) low = true;   // ≤2 核 CPU 判定低端
            if (mem && mem <= 2) low = true;       // ≤2GB 内存判定低端
        } catch(e){}
        __lowPerf = low;
        return low;
    }
    // 视频卡顿自动降级为同名静图（低端设备/网络卡顿时保持画面可见、不卡顿）
    function degradeToPoster(panel, data, video){
        if (!panel || panel.dataset.degraded === '1') return;   // 已降级，避免重复
        panel.dataset.degraded = '1';
        try { if (video) { video.pause(); video.remove(); } } catch(e){}
        const poster = data.poster || '';
        if (poster) {
            panel.style.backgroundImage = `url('${poster}')`;
            panel.style.backgroundPosition = 'center center';
        }
    }

    // ==================== 打开知识卡片弹窗 ====================
    function openModal(data) {
        const modal = document.getElementById('cardModal');
        currentCard = data;
        // 打开卡片时暂停 3D 背景动画，释放 GPU（移动端防卡顿）
        if (window.__threeCtl) window.__threeCtl.stop();

        // 1. 左侧媒体：按设备性能自适应——低端设备直接显示静图，高端设备播放视频；
        //    视频运行中若缓冲/停滞（卡顿）则自动降级为同名静图，保持画面可见、不卡顿。
        //    图片 → background-image 等比覆盖填充；视频 → <video> 全屏填充（autoplay/loop/muted/playsinline）。
        const leftPanel = document.getElementById('modalImage');
        const mediaSrc = data.image || '日.mp4';
        const posterSrc = data.poster || '';
        const isVideoMedia = /\.(mp4|webm|ogg|mov|m4v)$/i.test(mediaSrc);
        const existingVideo = leftPanel.querySelector('video.modal-media');
        if (existingVideo) existingVideo.remove();
        leftPanel.dataset.degraded = '';   // 每次打开重置降级标记，重新判断视频/静图
        const useVideo = isVideoMedia && !isLowPerfDevice();
        if (useVideo) {
            leftPanel.style.backgroundImage = 'none';
            const mv = document.createElement('video');
            mv.className = 'modal-media';
            mv.src = mediaSrc;
            mv.setAttribute('playsinline', '');
            mv.setAttribute('webkit-playsinline', '');
            mv.style.cursor = 'pointer';
            mv.autoplay = true; mv.loop = true; mv.muted = true;
            mv.setAttribute('preload', 'none');   // 仅开卡时按需加载，避免提前缓冲大体积视频
            if (posterSrc) mv.poster = posterSrc;  // 视频缓冲期间先展示压缩静图，秒开不空白
            // 点击视频可暂停/继续播放（静音自动播放为主）
            mv.addEventListener('click', (e) => {
                e.stopPropagation();
                if (mv.paused) { const pp = mv.play(); if (pp && pp.catch) pp.catch(() => {}); }
                else mv.pause();
            });
            // 仅在真正停滞(stalled)或加载失败(error)时降级为静图；正常缓冲(waiting)不降级，保证视频顺畅播放
            const degrade = () => degradeToPoster(leftPanel, data, mv);
            mv.addEventListener('stalled', degrade);
            mv.addEventListener('error', degrade);
            const p = mv.play();
            if (p && p.catch) p.catch(() => {});
            leftPanel.insertBefore(mv, leftPanel.firstChild);
        } else {
            // 静图：优先同名静图 poster，无则回退原 mediaSrc
            leftPanel.style.backgroundImage = `url('${posterSrc || mediaSrc}')`;
            leftPanel.style.backgroundPosition = 'center center';
        }

        // 读一读弹窗：根据图片主色 / 主题自动适配配色（背景透明，与左侧图片自然融合）
        try { ReadPopupTheme.applyForImage(document.getElementById('readPopup'), data.image || '日.mp4', ReadPopupConfig); } catch(e){}

        // 2. 左侧大字展示
        document.getElementById('leftCharDisplay').textContent = data.char;
        // 2.1 正面醒目核心字展示
        document.getElementById('ui-core').textContent = data.char;

        // 3. 渲染基础教学数据：拼音 / 单词拆为独立字母对象（点击喇叭后逐字母高亮）
        renderPinyinLetters(document.getElementById('ui-pinyin'), data.pinyin);
        document.getElementById('ui-words').textContent = "组词：" + data.words.join('、');
        // 英语单词：拆为独立字母对象，展示在拼音下方
        renderWordLetters(document.getElementById('ui-english'), data.english);

        // 4. 渲染释义（小知识已整合进「读一读」弹窗，此处不再单独渲染）

        // 5. 部首与字形三合一（部首 / 笔画 / 结构 融于同一加宽模块）
        const radicalBox = document.getElementById('ui-radical-box');
        const rRadical = radicalBox.querySelector('.struct-radical'); if (rRadical) rRadical.textContent = data.radical || '—';
        const rStrokes = radicalBox.querySelector('.struct-strokes'); if (rStrokes) rStrokes.textContent = (data.strokes || 0) + ' 画';
        const rType = radicalBox.querySelector('.struct-type'); if (rType) rType.textContent = data.structure || '—';

        // 6. 渲染造句示例（造句已整合进「读一读」弹窗，此处不再单独渲染）

        // 6.1 渲染笔画名称（按课标笔顺，含笔画类型）
        const strokesBox = document.getElementById('ui-strokes');
        strokesBox.querySelector('.stroke-num-total').textContent = (data.strokes || 0);
        const strokeList = strokesBox.querySelector('.stroke-list');
        strokeList.innerHTML = '';
        (data.strokesName || []).forEach((nm, i) => {
            const chip = document.createElement('div');
            chip.className = 'stroke-chip';
            chip.innerHTML = `<span class="stroke-num">${i + 1}</span><span class="stroke-name">${nm}</span><span class="stroke-type">${strokeType(nm)}</span>`;
            strokeList.appendChild(chip);
        });

        // 7. 初始化田字格与 Hanzi Writer：先确保字库+本地笔画数据已加载（首次开卡时按需拉取，同源 libs/），
        //    加载完成后再创建双层田字格；字库加载失败也绝不影响弹窗显示，并给出明确提示（不再静默失效）。
        try {
            // 依赖已就绪（已缓存）则无需显示“加载中”，避免每次开卡闪烁
            if (!(typeof HanziWriter !== 'undefined' && window.__HANZI_DATA__)) setTzgStatus('笔画组件加载中…');
            ensureHanziWriter().then(() => {
                try {
                    createTzgWriters(data);
                    clearTzgStatus();
                } catch (e) {
                    console.warn('田字格初始化失败（不影响弹窗显示）：', e);
                }
            }).catch((e) => {
                console.warn('HanziWriter 加载失败：', e);
                // 依赖最终未加载（如 libs/ 未部署到 GitHub、网络持续异常）：明确提示并可点此重试
                const miss = criticalMissingHint();
                const hint = miss.length ? '（缺失：' + miss.join('、') + '）' : '';
                setTzgStatus('笔画组件未能加载，点此重试' + hint, true, () => { _hwPromise = null; openModal(data); });
                showDeployWarning(miss);
            });
        } catch (e) {
            console.warn('田字格初始化调度失败（不影响弹窗显示）：', e);
        }

        // 9. 绑定按钮动作（每个按钮独立，stopPropagation 防止事件冒泡干扰）
        document.getElementById('btn-animate').onclick = (e) => {
            e.stopPropagation();
            playStrokeAnim(data);   // 笔顺动画：逐笔播放并同步高亮左侧笔画名称
        };
        document.getElementById('btn-audio').onclick = (e) => {
            e.stopPropagation();
            const rp = document.getElementById('readPopup');
            if (rp.classList.contains('show')) {
                closeReadPopup();   // 弹窗已打开：再次点击「读一读」关闭弹窗（与原关闭按钮共用 closeReadPopup，状态一致、互不冲突）
            } else {
                readAloud(data);    // 弹窗未打开：打开并语音朗读（保留原语音播放能力）
            }
        };
        // 趣味问答按钮 → 打开游戏化测验（先中止进行中的描红/朗读）
        document.getElementById('btn-quiz').onclick = (e) => {
            e.stopPropagation();
            ACTIVITY_TOKEN++;
            startQuiz(data);
        };

        // 拼音 / 英语 小喇叭：点击后逐字母高亮（替代原弹窗交互），并保留语音朗读
        document.getElementById('btnPinyin').onclick = (e) => { e.stopPropagation(); highlightPinyin(data); };
        document.getElementById('btnEnglish').onclick = (e) => { e.stopPropagation(); highlightWord(data); };
        // 描红讲解 / 描红练习（拆为两个独立按钮，均支持反复点击与反复练习）
        document.getElementById('btn-trace-guide').onclick = (e) => {
            e.stopPropagation();
            ACTIVITY_TOKEN++;
            hideTraceGuidePop();   // 改用讲解时收起描写引导弹窗
            if (traceQuizActive) try { traceWriter.cancelQuiz(); } catch(ex){}
            traceQuizActive = false;
            traceGuide(data);
        };
        document.getElementById('btn-trace').onclick = (e) => {
            e.stopPropagation();
            ACTIVITY_TOKEN++;
            // 取消进行中的描红测验，避免重复触发
            if (traceQuizActive) try { traceWriter.cancelQuiz(); } catch(ex){}
            traceQuizActive = false;
            tracePractice(data);
        };
        // 重置按钮：立即清空笔迹、重新进入书写模式（静默，不打扰书写）
        document.getElementById('btn-reset').onclick = (e) => {
            e.stopPropagation();
            ACTIVITY_TOKEN++;
            window.speechSynthesis.cancel();
            if (traceQuizActive) try { traceWriter.cancelQuiz(); } catch(ex){}
            traceQuizActive = false;
            resetTraceWriter(data);   // 清空蓝色笔迹，支持立即重新书写
            try { baseWriter.showOutline(); baseWriter.hideCharacter(); } catch(e){}
            enableQuiz(data);         // 立即重新进入书写模式
        };

        // 10. 点击字头区域（拼音）也可触发读音，强化认读反馈
        document.querySelector('.char-header').onclick = (e) => {
            e.stopPropagation();
            speakAudio(`${data.char}，${data.pinyin}`);
        };

        // 重置：隐藏趣味问答面板、读一读弹窗与拼读浮窗，复位顶部拖动
        document.getElementById('quizBox').classList.remove('show');
        closeReadPopup();                    // 重置：隐藏读一读弹窗并停止其自动滚动/跟随高亮
        hideBlend(); blendType = null; clearLetterHL();
        hideTraceGuidePop();                 // 收起描写引导弹窗
        const tbReset = document.getElementById('topBlock');
        if (tbReset) { tbReset.style.transform = ''; topDrag.x = 0; topDrag.y = 0; }
        // 读一读 弹窗关闭按钮（独立绑定，stopPropagation 防冒泡）
        document.getElementById('readPopupClose').onclick = (e) => {
            e.stopPropagation();
            closeReadPopup();
        };
        // 读一读 弹窗主题切换按钮 🎨（循环：auto→warm→cool→dark→light→auto）
        document.getElementById('readPopupTheme').onclick = (e) => {
            e.stopPropagation();
            const order = ['auto','warm','cool','dark','light'];
            const idx = (order.indexOf(ReadPopupConfig.theme) + 1) % order.length;
            setReadPopupTheme(order[idx]);
        };
        // 11. 重置翻转卡片到正面（每次打开都从正面开始）
        const inner = document.getElementById('flipCardInner');
        inner.classList.remove('flipped');
        document.getElementById('flipBtn').textContent = '🔄 翻到背面 ✍️';

        // 12. 显示弹窗并自动朗读
        modal.classList.add('active');
        setTimeout(() => {
            const prefix = (SCENE_CONFIG[currentScene] || {}).speakPrefix || '自然元素';
            speakAudio(`你发现了${prefix}——${data.char}，${data.pinyin}！`);
        }, 700); // 等3D翻转动画完成后再朗读
    }

    // ==================== 关闭弹窗 ====================
    function closeModal() {
        const modal = document.getElementById('cardModal');
        modal.classList.remove('active');
        // 暂停左侧视频，避免弹窗关闭后仍后台播放消耗资源
        const lp = document.getElementById('modalImage');
        const v = lp && lp.querySelector('video.modal-media');
        if (v) { try { v.pause(); } catch(e){} }
        window.speechSynthesis.cancel();
        // 关闭卡片后恢复 3D 背景（仅当页面仍可见）
        if (window.__threeCtl && !document.hidden) window.__threeCtl.start();
    }

    // ==================== 翻转卡片（正面 <-> 背面） ====================
    function flipCard() {
        const inner = document.getElementById('flipCardInner');
        const btn = document.getElementById('flipBtn');
        const flipped = inner.classList.toggle('flipped');
        btn.textContent = flipped ? '🔄 翻回正面 🏠' : '🔄 翻到背面 ✍️';
        // 翻到背面时收起「读一读」面板（该阅读面板归属正面，避免与背面书写区视觉重叠）
        if (flipped) { closeReadPopup(); }
    }

    // 点击遮罩层也可关闭
    document.getElementById('cardModal').addEventListener('click', (e) => {
        if (e.target.id === 'cardModal') closeModal();
    });

    // ESC键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // ==================== TTS语音播报（优化版） ====================
    let SPEECH_TOKEN = 0;     // 语音令牌：每次新朗读自增，旧回调据此放弃，杜绝叠加/抢拍
    let ACTIVITY_TOKEN = 0;   // 活动令牌：用户点击新按钮时自增，正在进行的描红循环据此外退
    async function speakAudio(text) {
        const myToken = ++SPEECH_TOKEN;       // 占用令牌，取消此前所有语音
        await ensureVoices('zh');            // 先确认中文语音已加载，避免退回英文默认音
        const synth = window.speechSynthesis;
        synth.cancel();                       // 先停掉正在播放的语音，避免叠加
        await sleep(90);                      // 取消后稍候再播，规避 Chrome 竞态导致整句不出声
        if (myToken !== SPEECH_TOKEN) return; // 已被新动作取代，放弃本次

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = userRatePref;        // 语速：默认 1 倍（可在语音区「⏩」按钮调节）
        utterance.pitch = 1.2;                // 音调稍高，亲切感
        utterance.volume = 1.0;

        // 选择标准中文（普通话）语音，排除港台繁体
        const zhVoice = getVoice('zh-CN');
        if (zhVoice) { utterance.voice = zhVoice; utterance.lang = zhVoice.lang; }

        let fin = false;
        const done = () => { if (fin) return; fin = true; };
        utterance.onend = done; utterance.onerror = done;
        synth.speak(utterance);
    }

    // 语音列表加载由 ensureVoices() 统一处理（见下方）

    // ==================== 拼音拼读（声母+韵母+声调，符合课标） ====================
    const ZHYR = ['zhi','chi','shi','ri','zi','ci','si','yi','wu','yu','ye','yue','yuan','yin','yun','ying'];
    const INITIALS = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w'];
    // 声母呼读音：保证中文 TTS 读成「bo/po/mo…」而非英语字母音「bee/pee…」
    const INITIAL_READ = {
        'b':'bo','p':'po','m':'mo','f':'fo','d':'de','t':'te','n':'ne','l':'le',
        'g':'ge','k':'ke','h':'he','j':'ji','q':'qi','x':'xi',
        'zh':'zhi','ch':'chi','sh':'shi','r':'ri','z':'zi','c':'ci','s':'si',
        'y':'yi','w':'wu'
    };
    // 声母呼读音对应汉字：朗读时不使用拉丁字母（避免被中文TTS读成英语字母音），
    // 而用与呼读音同音的汉字（如 b→玻、x→西），保证语音读成正确音节。
    const INITIAL_CHAR = {
        'b':'玻','p':'坡','m':'摸','f':'佛','d':'得','t':'特','n':'讷','l':'勒',
        'g':'哥','k':'科','h':'喝','j':'鸡','q':'欺','x':'西',
        'zh':'知','ch':'吃','sh':'诗','r':'日','z':'资','c':'雌','s':'思',
        'y':'衣','w':'屋'
    };
    // 韵母呼读音对应汉字（j/q/x/y 后的 u 实为 ü，已转换）。用于拼音拼读朗读，避免英文发音。
    const FINAL_CHAR = {
        'a':'啊','o':'喔','e':'鹅','er':'耳',
        'ai':'爱','ei':'诶','ao':'奥','ou':'欧',
        'an':'安','en':'恩','ang':'昂','eng':'鞥','ong':'轰',
        'i':'衣','ia':'呀','ie':'耶','iao':'腰','iu':'忧','ian':'烟','in':'因','iang':'央','ing':'英','iong':'庸',
        'u':'乌','ua':'哇','uo':'窝','uai':'歪','ui':'威','uan':'弯','un':'温','uang':'汪','ueng':'翁',
        'v':'迂','ve':'约','van':'冤','vn':'晕'
    };
    const TONE_MAP = { 'ā':'a','á':'a','ǎ':'a','à':'a','ē':'e','é':'e','ě':'e','è':'e','ī':'i','í':'i','ǐ':'i','ì':'i','ō':'o','ó':'o','ǒ':'o','ò':'o','ū':'u','ú':'u','ǔ':'u','ù':'u','ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v','ü':'v' };
    function stripTone(s){ return s.split('').map(c => TONE_MAP[c] || c).join(''); }
    function getTone(s){ if(/[āēīōūǖ]/.test(s)) return 1; if(/[áéíóúǘ]/.test(s)) return 2; if(/[ǎěǐǒǔǚ]/.test(s)) return 3; if(/[àèìòùǜ]/.test(s)) return 4; return 0; }
    function splitPinyin(base){
        for (const ini of INITIALS) { if (base.startsWith(ini)) return [ini, base.slice(ini.length)]; }
        return ['', base];
    }
    // 韵母呼读音（去声调，主元音用大写字母标记，便于后续定位加声调）。
    // 给 i/u/ü 开头的韵母补 y/w 头，让中文 TTS 读成标准韵母音（如 ing→ying「英」、u→wu「乌」），
    // 避免直接读裸字母被念成英语字母音（i-n-g）。
    const FINAL_READ = {
        'a':'A','o':'O','e':'E','er':'Er',
        'ai':'Ai','ei':'Ei','ao':'Ao','ou':'Ou',
        'an':'An','en':'En','ang':'Ang','eng':'Eng','ong':'Ong',
        'i':'yI','ia':'yA','ie':'yE','iao':'yAo','iu':'yOu','ian':'yAn',
        'in':'yIn','iang':'yAng','ing':'yIng','iong':'yOng',
        'u':'wU','ua':'wA','uo':'wO','uai':'wAi','ui':'wEi','uan':'wAn',
        'un':'wEn','uang':'wAng','ueng':'wEng',
        'v':'yV','ve':'yuE','van':'yuAn','vn':'yVn'
    };
    const TONE_LETTERS = {
        1:{a:'ā',o:'ō',e:'ē',i:'ī',u:'ū',v:'ǖ'},
        2:{a:'á',o:'ó',e:'é',i:'í',u:'ú',v:'ǘ'},
        3:{a:'ǎ',o:'ǒ',e:'ě',i:'ǐ',u:'ǔ',v:'ǚ'},
        4:{a:'à',o:'ò',e:'è',i:'ì',u:'ù',v:'ǜ'}
    };
    // 韵母呼读音：将带调韵母转换为标准中文呼读音（含正确声调标注）
    function finalCallRead(finToned, ini){
        let base = stripTone(finToned);
        // j/q/x/y 后的 u 实为 ü（如 xuě 的韵母 uě → üě）
        if (['j','q','x','y'].indexOf(ini) >= 0 && base.charAt(0) === 'u') {
            base = 'v' + base.slice(1);
        }
        const tone = getTone(finToned);
        let call = FINAL_READ[base] || base;
        if (tone >= 1 && tone <= 4) {
            const m = call.match(/[A-Z]/);
            if (m) {
                const lower = m[0].toLowerCase();
                const toned = (TONE_LETTERS[tone] || {})[lower] || lower;
                call = call.replace(m[0], toned);
            }
        }
        return call;
    }

    // ---------- 语音队列 + 高亮展示（拼音/英语通用） ----------
    // 语言标签归一化：en_US → en-us（各引擎对下划线/连字符支持不一，统一连字符最稳）
    function normLang(s){ return String(s || '').toLowerCase().replace(/_/g, '-'); }
    // 等待语音列表加载完成：首次 getVoices 可能为空，若直接朗读会退回系统默认（可能为英文）音，导致拼音被读成英文。
    // targetLang：需要等待的目标语言（如 'zh' / 'en'）。iOS Safari 的语音列表是【分批返回】的——
    // 首次 voiceschanged 往往只有当前系统语言（如中文），英语语音在后续事件才出现；若此刻就去
    // getVoice('en') 会拿不到英语语音 → 不设 voice → iOS 回退用系统中文语音读英文字母（读出
    // 「西/鸡/街/达不溜」这类中文腔字母音）。因此这里等待到「目标语言出现」或「多次事件仍无 /
    // 超时」才返回，兼顾读音正确性与流畅性（真没装英语语音的设备最多多等片刻，按 lang 兜底）。
    function ensureVoices(targetLang){
        return new Promise((resolve) => {
            const synth = window.speechSynthesis;
            let done = false, tries = 0, timer = null;
            const cleanup = () => { if ('onvoiceschanged' in synth) synth.onvoiceschanged = null; clearTimeout(timer); };
            const finish = (list) => { if (done) return; done = true; cleanup(); populateVoicePanel(); resolve(list || synth.getVoices()); };
            const check = () => {
                const list = synth.getVoices() || [];
                if (!list.length) return false;                                   // 列表还没出来，继续等
                if (!targetLang) { finish(list); return true; }                   // 无目标语言要求：列表非空即就绪
                const T = normLang(targetLang);
                const hit = list.some(v => {
                    const L = normLang(v.lang);
                    return L === T || L.startsWith(T + '-');
                });
                if (hit) { finish(list); return true; }                           // 目标语言已出现
                return false;                                                     // 有列表但缺目标语言：等 voiceschanged 再试
            };
            if ('onvoiceschanged' in synth) {
                synth.onvoiceschanged = () => {  // iOS 会多次触发，每次列表更完整（分批返回）
                    tries++;
                    if (done) return;
                    if (check() || tries >= 4) finish(synth.getVoices());
                };
            }
            timer = setTimeout(() => finish(synth.getVoices()), 2500); // 兜底：目标语言始终未出现（设备未装该语言）则按现状继续
            check();
        });
    }
    // 选择中文/英文语音：排除港台繁体，兼容 cmn/Chinese/Mandarin 等标注，优先 zh-CN；
    // 英语匹配按优先级：精确（en-US/en_US 归一化后相等）→ 美音 en-US → 标准 en-XX → 任意 en 开头，
    // 避免误选「en-x-自定义」等非标准语音导致读音异常。
    function getVoice(lang){
        const voices = window.speechSynthesis.getVoices() || [];
        if (!voices.length) return null;
        // 用户已选择语音（免费内置语音包）：按名称精确匹配，确保「设置语音」与「实际播放」一致（修复 iPad 不一致）
        if (userVoicePref && lang && lang.toLowerCase().startsWith('zh')) {
            const pick = voices.find(v => v.name === userVoicePref.name && (v.lang || '') === userVoicePref.lang)
                      || voices.find(v => v.name === userVoicePref.name);
            if (pick) return pick;
        }
        if (lang && normLang(lang).startsWith('en')) {
            const T = normLang(lang);
            return voices.find(v => normLang(v.lang) === T)                      // 1) 精确匹配（en-US / en_US 均可）
                || voices.find(v => /^en(-|_)us$/i.test(v.lang || ''))           // 2) 美音优先（幼儿英语启蒙多用美音）
                || voices.find(v => /^en(-|_)[a-z]{2}$/i.test(normLang(v.lang))) // 3) 标准 en-XX（en-GB / en-AU …）
                || voices.find(v => /^en/i.test(v.lang || ''))                   // 4) 任意 en 开头（含 en-x-*）
                || null;
        }
        const isZh = (v) => {
            const L = (v.lang || '').toLowerCase();
            if (L.includes('tw') || L.includes('hk') || L.includes('hant')) return false;
            return L.startsWith('zh') || L.includes('cmn') || L.includes('chinese') || L.includes('mandarin');
        };
        return voices.find(v => isZh(v) && /^zh-cn/i.test(v.lang || ''))
            || voices.find(isZh)
            || null;
    }
    // ==================== 免费内置语音包（设备 TTS 语音选择，持久化） ====================
    let userVoicePref = null;
    function loadVoicePref(){ try { const r = localStorage.getItem('ttsVoice'); if (r) userVoicePref = JSON.parse(r); } catch(e){} }
    function isZhVoice(v){
        const L = (v.lang || '').toLowerCase();
        if (L.includes('tw') || L.includes('hk') || L.includes('hant')) return false;
        return L.startsWith('zh') || L.includes('cmn') || L.includes('chinese') || L.includes('mandarin');
    }
    function populateVoicePanel(){
        const panel = document.getElementById('voicePanel');
        if (!panel) return;
        const voices = (window.speechSynthesis.getVoices() || []).filter(isZhVoice);
        if (!voices.length) {
            panel.innerHTML = '<h4>🔊 语音设置</h4><div class="vp-tip">当前设备/浏览器未提供免费中文语音，可在系统设置中开启「语音合成」，或换用 Chrome / Safari 后重试。</div>';
            return;
        }
        let html = '<h4>🔊 选择语音（免费内置）</h4>';
        voices.forEach((v) => {
            const active = (userVoicePref && userVoicePref.name === v.name) ? ' active' : '';
            html += '<button class="voice-opt' + active + '" data-name="' + v.name + '" data-lang="' + v.lang + '">' + v.name + '<br><small>' + v.lang + '</small></button>';
        });
        panel.innerHTML = html;
        panel.querySelectorAll('.voice-opt').forEach((b) => {
            b.addEventListener('click', () => selectVoice(b.dataset.name, b.dataset.lang));
        });
    }
    function selectVoice(name, lang){
        userVoicePref = { name: name, lang: lang };
        try { localStorage.setItem('ttsVoice', JSON.stringify(userVoicePref)); } catch(e){}
        const panel = document.getElementById('voicePanel');
        if (panel) panel.querySelectorAll('.voice-opt').forEach((b) => b.classList.toggle('active', b.dataset.name === name));
        // 立即试播，确认所选语音确实生效（修复 iPad「设置语音」与「实际播放」不一致）
        speakAudio('你好');
    }
    function toggleVoicePanel(){
        const panel = document.getElementById('voicePanel');
        if (!panel) return;
        const show = panel.style.display !== 'block';
        panel.style.display = show ? 'block' : 'none';
        if (show) populateVoicePanel();
    }
    // 点击面板外部自动收起
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('voicePanel');
        if (panel && panel.style.display === 'block' && !panel.contains(e.target) && e.target.id !== 'btnVoice') {
            panel.style.display = 'none';
        }
    });
    // 点击语速面板外部自动收起
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('ratePanel');
        if (panel && panel.style.display === 'block' && !panel.contains(e.target) && e.target.id !== 'btnRate') {
            panel.style.display = 'none';
        }
    });
    // iPad/Safari 首次需用用户手势「唤醒」语音引擎，否则首句可能无声或回退默认音
    let _ttsWarmed = false;
    function warmTTS(){
        if (_ttsWarmed) return; _ttsWarmed = true;
        try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } catch(e){}
    }
    document.addEventListener('pointerdown', warmTTS, { once: true });

    // ==================== 语速控制（默认 1 倍，用户可调节并持久化） ====================
    let userRatePref = 1.0;
    const RATE_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5];
    function loadRatePref(){
        try { const r = parseFloat(localStorage.getItem('ttsRate')); if (!isNaN(r) && r > 0) userRatePref = r; } catch(e){}
    }
    function syncRateBtn(){
        const b = document.getElementById('btnRate');
        if (b) b.textContent = '⏩ ' + userRatePref + '×';
    }
    // 语速下拉面板：从多个预设选项中选择（默认 1 倍）
    function populateRatePanel(){
        const panel = document.getElementById('ratePanel');
        if (!panel) return;
        let html = '<h4>⏩ 选择语速</h4>';
        RATE_STEPS.forEach((r) => {
            const active = (Math.abs(r - userRatePref) < 1e-6) ? ' active' : '';
            const label = (Math.abs(r - 1.0) < 1e-6) ? '1×（标准）' : (r + '×');
            html += '<button class="rate-opt' + active + '" data-rate="' + r + '">' + label + '</button>';
        });
        panel.innerHTML = html;
        panel.querySelectorAll('.rate-opt').forEach((b) => {
            b.addEventListener('click', () => selectRate(parseFloat(b.dataset.rate)));
        });
    }
    function selectRate(r){
        userRatePref = r;
        try { localStorage.setItem('ttsRate', String(r)); } catch(e){}
        syncRateBtn();
        const panel = document.getElementById('ratePanel');
        if (panel) { panel.style.display = 'none'; populateRatePanel(); }
        speakAudio('你好');   // 试播，确认语速生效
    }
    function toggleRatePanel(){
        const panel = document.getElementById('ratePanel');
        if (!panel) return;
        const show = panel.style.display !== 'block';
        panel.style.display = show ? 'block' : 'none';
        if (show) populateRatePanel();
    }

    // 逐条朗读，朗读第 i 条前回调 onStart(i) 用于高亮。
    // 采用 SPEECH_TOKEN 令牌：调用即占用新令牌并取消旧语音；旧回调因令牌不符而放弃，
    // 避免不同朗读任务相互打断/叠加。watchdog 估值偏宽松，确保 onend 先触发再结束。
    function speakQueue(items, lang, onStart, onFinish, onEnd){
        return new Promise(async (resolve) => {
            const myToken = ++SPEECH_TOKEN;
            const synth = window.speechSynthesis;
            const isEn = lang && lang.toLowerCase().startsWith('en');
            // 等待目标语言语音就绪（iOS 语音列表分批返回：英语朗读前必须等到 en 语音出现，
            // 否则会回退用系统中文语音读英文字母，读音变成中文腔「西/鸡/街」）
            await ensureVoices(isEn ? 'en' : 'zh');
            const v = getVoice(lang);
            if (isEn && !v) {
                // 兜底：设备确实未提供英语语音时保留 lang 交由系统按语言朗读（iOS 内置英语合成仍可正确发音），
                // 并给出排查提示；绝不回退用中文语音读英文字母。
                console.warn('未找到英语语音，将按 lang=' + (lang || 'en-US') + ' 由系统默认语音朗读；若读音异常，请在系统设置中启用英语语音。');
            }
            for (let i = 0; i < items.length; i++) {
                if (myToken !== SPEECH_TOKEN) { resolve(); return; } // 已被新动作取消
                if (onStart) onStart(i);
                await new Promise((res) => {
                    const text = items[i];
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = v ? normLang(v.lang) : (lang || 'zh-CN');   // 语言标签统一连字符（en_US→en-US），引擎兼容性更好
                    u.rate = userRatePref;
                    u.pitch = isEn ? 1.0 : 1.15;
                    u.volume = 1.0;
                    if (v) { u.voice = v; }
                    let fin = false; const done = () => { if (fin) return; fin = true; res(); };
                    // onEnd：本句朗读结束后再触发（用于“读完再高亮”，保证高亮时机与读音一致）
                    u.onend = () => { if (onEnd) onEnd(i); done(); };
                    u.onerror = () => { if (onEnd) onEnd(i); done(); };
                    u.onstart = () => { if (onStart) onStart(i); };   // 语音真正开始播放即触发高亮（与实际播放同步，消除原 onEnd 滞后）
                    synth.speak(u);
                    // 兜底超时：务必长于真实朗读时长，让 onend 始终先触发再结束，
                    // 防止提前 resolve 导致弹窗提前收起/下一句抢拍（造成播报中断）
                    const est = Math.max(3000, text.length * 480) + 3000;
                    setTimeout(done, est);
                });
                if (myToken !== SPEECH_TOKEN) { resolve(); return; }
                // 句间停顿仅作缓冲：上一句由 onend 真实播完才进入此处，无需过长。
                // 英文单字母/超短句 100ms、其余 80ms，语音连贯自然（onend 已防 iOS 吞音/抢拍）。
                await sleep((isEn && items[i].length <= 4) ? 100 : 80);
            }
            if (onFinish) onFinish();
            resolve();
        });
    }
    // 高亮展示区：渲染 chips 并控制当前朗读项高亮
    function showBlend(title, steps){
        document.getElementById('blendTitle').textContent = title;
        const chips = document.getElementById('blendChips');
        chips.innerHTML = '';
        steps.forEach((s) => {
            const d = document.createElement('div');
            d.className = 'blend-chip';
            d.innerHTML = `<span class="bc-label">${s.label}</span><span class="bc-val">${s.val}</span>`;
            chips.appendChild(d);
        });
        document.getElementById('blendBar').classList.add('show');
    }
    function hlBlend(i){
        const chips = document.getElementById('blendChips').children;
        for (let k = 0; k < chips.length; k++) chips[k].classList.toggle('active', k === i);
    }
    function hideBlend(){ document.getElementById('blendBar').classList.remove('show'); }
    // 喇叭按钮显隐切换：点同一喇叭再次点击则隐藏；点另一喇叭则切换内容并保持显示
    function toggleBlend(type, data){
        const bar = document.getElementById('blendBar');
        if (blendType === type && bar.classList.contains('show')) {
            hideBlend(); blendType = null; window.speechSynthesis.cancel(); return;
        }
        blendType = type;
        if (type === 'pinyin') pinyinBlend(data); else englishPhonics(data);
    }

    // 拼音拼读：声母/韵母/全拼均用中文呼读音汉字朗读（如 西/英/威），彻底避免中文TTS
    // 把拉丁拼音读成英语字母音。朗读内容全部为中文，芯片上仍展示拉丁拼音供幼儿认知。
    async function pinyinBlend(pd){
        ACTIVITY_TOKEN++; window.speechSynthesis.cancel();  // 用户主动触发：停掉旧语音与描红
        const pinyin = pd.pinyin;
        const char = pd.char;
        const base = stripTone(pinyin);
        const tone = getTone(pinyin);
        const toneName = ['','第一声','第二声','第三声','第四声'][tone] || '轻声';
        if (ZHYR.includes(base)) {
            showBlend('🔤 整体认读', [{ label:'整体认读', val: pinyin }]);
            await speakQueue(['整体认读音节。' + char + '。不用拼，直接读。' + char + '。'], 'zh-CN', (i) => hlBlend(i));
            return;
        }
        const [ini, fin] = splitPinyin(base);
        const iniChar = INITIAL_CHAR[ini] || ini;
        let fbase = stripTone(fin);
        if (['j','q','x','y'].indexOf(ini) >= 0 && fbase.charAt(0) === 'u') fbase = 'v' + fbase.slice(1);
        const finChar = FINAL_CHAR[fbase] || fin;
        const steps = [
            { label: ini ? '声母' : '零声母', val: ini || '∅' },
            { label:'韵母', val: fin },
            { label:'声调', val: toneName },
            { label:'全拼', val: pinyin }
        ];
        showBlend('🔤 拼音拼读', steps);
        const reads = [];
        // 引导词用逗号断句（中文 TTS 逗号停顿显著短于句号），减少拼读过程的感知停顿
        if (ini) reads.push('声母，' + iniChar);
        reads.push('韵母，' + finChar);
        reads.push(toneName);
        reads.push(iniChar + ' 和 ' + finChar + ' 拼成 ' + char + '。');
        await speakQueue(reads, 'zh-CN', (i) => hlBlend(i));
    }

    // ==================== 英语自然拼读（字母音 + 单词，含高亮） ====================
    // 英语本就该逐字母读，故保留拉丁字母；朗读完整后再收起弹窗。
    async function englishPhonics(pd){
        ACTIVITY_TOKEN++; window.speechSynthesis.cancel();
        const word = pd.english;
        const letters = word.split('');
        const steps = letters.map((L, i) => ({ label:'第' + (i+1) + '个字母', val: L }));
        steps.push({ label:'单词', val: word });
        showBlend('🔡 英语拼读', steps);
        // 逐字母朗读必须用【小写】字母：iOS 英语 TTS 对全大写文本会在每个字母前加读「Capital」
        //（如 S→"Capital S"），小写字母则直接读标准字母名（s→"ess"），且桌面/安卓同样正确。
        const reads = letters.map(L => L.toLowerCase()).concat([word.toLowerCase()]);
        await speakQueue(reads, 'en-US', (i) => hlBlend(i));
    }

    // ==================== 顶部字母拆分 + 逐字母高亮（替代原拼读弹窗） ====================
    // 拼音声母/韵母、英文单词的字母 span 引用，供逐字母高亮使用
    let pinyinIniSpans = [], pinyinFinSpans = [], wordLetterSpans = [];

    // 保留声调的拼音拆分：声母为起始辅音（无调），韵母为剩余部分（保留声调标注）
    function splitPinyinToned(py){
        for (const ini of INITIALS) { if (py.startsWith(ini)) return [ini, py.slice(ini.length)]; }
        return ['', py];
    }
    // 清除 #topBlock 内所有字母高亮
    function clearLetterHL(){
        const ls = document.querySelectorAll('#topBlock .letter.hl');
        for (let k = 0; k < ls.length; k++) ls[k].classList.remove('hl');
    }
    // 将拼音拆为「声母组 + 韵母组」两组独立字母对象
    function renderPinyinLetters(el, pinyin){
        el.innerHTML = '';
        pinyinIniSpans = []; pinyinFinSpans = [];
        const [ini, fin] = splitPinyinToned(pinyin);
        if (ini){
            const g = document.createElement('span'); g.className = 'py-part shengmu';
            for (const ch of ini){ const s = document.createElement('span'); s.className = 'letter'; s.textContent = ch; g.appendChild(s); pinyinIniSpans.push(s); }
            el.appendChild(g);
        }
        const g2 = document.createElement('span'); g2.className = 'py-part yunmu';
        for (const ch of fin){ const s = document.createElement('span'); s.className = 'letter'; s.textContent = ch; g2.appendChild(s); pinyinFinSpans.push(s); }
        el.appendChild(g2);
    }
    // 将英文单词拆为逐字母独立对象
    function renderWordLetters(el, word){
        el.innerHTML = '';
        wordLetterSpans = [];
        for (const ch of word){
            const s = document.createElement('span'); s.className = 'letter'; s.textContent = ch; el.appendChild(s); wordLetterSpans.push(s);
        }
    }

    // 点击拼音喇叭：按「声母 → 韵母」顺序朗读，对应的拼音组在【语音开始播放的瞬间】即刻高亮
    // （高亮与读音完全同步，无滞后）；全部音节读完后整体高亮所有拼音字母；朗读用中文呼读音，避免读成英语字母音。
    // 速度由语音实际时长驱动（不再用固定短延时抢跑），整体节奏更舒缓、适合幼儿。
    async function highlightPinyin(data){
        const my = ++ACTIVITY_TOKEN;
        window.speechSynthesis.cancel();
        clearLetterHL();
        const pinyin = data.pinyin;
        const base = stripTone(pinyin);
        const tone = getTone(pinyin);
        const toneName = ['','第一声','第二声','第三声','第四声'][tone] || '轻声';
        let reads = [];
        // groupAfter：每句【开始播放时】应高亮的拼音组 —— 0=声母组，1=韵母组，null=本句不单独高亮
        let groupAfter = [];
        if (ZHYR.includes(base)){
            reads = ['整体认读音节。' + data.char + '。不用拼，直接读。' + data.char + '。'];
            groupAfter = [null];
        } else {
            const [ini, fin] = splitPinyin(base);
            const iniChar = INITIAL_CHAR[ini] || ini;
            let fbase = stripTone(fin);
            if (['j','q','x','y'].indexOf(ini) >= 0 && fbase.charAt(0) === 'u') fbase = 'v' + fbase.slice(1);
            const finChar = FINAL_CHAR[fbase] || fin;
            // 引导词用逗号断句（中文 TTS 逗号停顿显著短于句号），减少拼读过程的感知停顿
            if (ini) { reads.push('声母，' + iniChar); groupAfter.push(0); }
            reads.push('韵母，' + finChar); groupAfter.push(1);
            reads.push(toneName); groupAfter.push(null);
            // 保留原有全部语音内容，仅省略声母与韵母之间的「和」字
            reads.push(iniChar + ' ' + finChar + ' 拼成 ' + data.char + '。'); groupAfter.push(null);
        }
        const allSpans = pinyinIniSpans.concat(pinyinFinSpans);
        // 高亮与语音播放同步：第 i 句【开始播放】即刻高亮其对应拼音组（无延迟）；全部读完整体高亮
        await speakQueue(reads, 'zh-CN',
            (i) => {                               // onStart：语音开始播放即高亮该组（与读音同步）
                if (my !== ACTIVITY_TOKEN) return;
                const g = groupAfter[i];
                if (g === 0) for (const s of pinyinIniSpans) s.classList.add('hl');
                else if (g === 1) for (const s of pinyinFinSpans) s.classList.add('hl');
            },
            () => {                                // onFinish：全部读完 → 整体高亮
                if (my === ACTIVITY_TOKEN) for (const s of allSpans) s.classList.add('hl');
            },
            null
        );
    }

    // 点击单词喇叭：逐字母朗读英文单词（读到哪字母，哪字母【开始播放】即高亮，高亮与读音完全同步、无滞后），
    // 整个单词读完后再整体高亮所有字母。
    async function highlightWord(data){
        const my = ++ACTIVITY_TOKEN;
        window.speechSynthesis.cancel();
        clearLetterHL();
        const word = data.english;
        const letters = word.split('');
        // 逐字母朗读用【小写】：iOS 英语 TTS 对全大写字母会加读「Capital」前缀音（S→"Capital S"），
        // 小写则读标准字母名（s→"ess"）；界面高亮仍用原大写 letters。
        const reads = letters.map(L => L.toLowerCase()).concat([word.toLowerCase()]);   // 逐字母(小写) + 末句整词
        const spans = wordLetterSpans;
        // 第 i 个字母开始播放即高亮该字母（与读音同步）；整词读完（onFinish）整体高亮所有字母
        await speakQueue(reads, 'en-US',
            (i) => {                               // onStart：第 i 个字母开始播放即高亮（与读音同步）
                if (my !== ACTIVITY_TOKEN) return;
                if (i < spans.length) spans[i].classList.add('hl');
            },
            () => {                                // onFinish：整词读完 → 整体高亮
                if (my === ACTIVITY_TOKEN) for (const s of spans) s.classList.add('hl');
            },
            null
        );
    }

    // ==================== 读一读 弹窗 · 配色 / 取色 / 滚动高亮 模块（职责分离） ====================
    // 模块 A：可动态配置配色（支持外部传入 accent / 主题切换 theme；图片主色为 auto 默认）
    const ReadPopupConfig = {
        theme: 'auto',                  // 'auto'=跟随图片主色 | 'light' | 'dark' | 'warm' | 'cool'
        accent: null,                   // 外部传入主色（hex/rgb 字符串），优先级高于 theme 与 auto
        bgAlpha: 0,                     // 弹窗背景透明度（0 = 完全透明）
        borderAlpha: 0.42,              // 边框/描边透明度
        headAlpha: 0.85,                // 头部底色透明度
        useImageAccentOnSections: false,// 是否把图片主色也应用到段落卡片（默认仅作用于边框/头部，保留分类色）
        autoScroll: false,              // 内容区自动上下滚动（按需求关闭：滚动改由语音发音进度驱动，readAloud 不再自动启动漫游）
        autoScrollSpeed: 0.28,          // 滚动速度 px/帧
        scrollPauseOnHover: true,       // 悬停/手动滚动时暂停自动滚动
        blur: 8                         // 背景轻微毛玻璃强度（不改变 background:transparent）
    };
    // 预设主题：theme 切换时使用的配色基线
    const RP_THEMES = {
        light: { accent:'#ff9f43', text:'#5a3a1a' },
        dark:  { accent:'#ffd27f', text:'#fff5e6' },
        warm:  { accent:'#ff7a45', text:'#5a2410' },
        cool:  { accent:'#5b9bd5', text:'#0d2a44' }
    };

    // —— 颜色工具（纯函数） ——
    function rpParseColor(str){
        if (!str) return null;
        str = String(str).trim();
        if (str[0] === '#'){
            let h = str.slice(1);
            if (h.length === 3) h = h.split('').map(c=>c+c).join('');
            if (h.length === 6) return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) };
        }
        const m = str.match(/rgba?\(([^)]+)\)/);
        if (m){ const p = m[1].split(',').map(s=>parseFloat(s)); return { r:p[0]||0, g:p[1]||0, b:p[2]||0 }; }
        return null;
    }
    function rpRgbToCss(c, a){ return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a==null?1:a})`; }
    function rpLuminance(c){ return (0.299*c.r + 0.587*c.g + 0.114*c.b) / 255; }
    // 提升主色可用性：保证一定饱和度与中等明度，避免过亮/过暗导致边框不可见
    function rpBoost(c){
        const max = Math.max(c.r,c.g,c.b), min = Math.min(c.r,c.g,c.b);
        const s = max===0?0:(max-min)/max;
        let L = rpLuminance(c), {r,g,b} = c;
        if (s < 0.42){ const gray=(r+g+b)/3, k=0.42; r+= (r-gray)*k*2.2; g+=(g-gray)*k*2.2; b+=(b-gray)*k*2.2; }
        if (L < 0.40){ const k=(0.40-L)/0.40*0.6; r+=(255-r)*k; g+=(255-g)*k; b+=(255-b)*k; }
        if (L > 0.72){ const k=(L-0.72)/0.28*0.6; r*=(1-k); g*=(1-k); b*=(1-k); }
        return { r:Math.max(0,Math.min(255,r)), g:Math.max(0,Math.min(255,g)), b:Math.max(0,Math.min(255,b)) };
    }

    // 模块 B：图片主色提取（纯取色，与弹窗渲染解耦）
    // file:// 下 canvas 读取像素会被 taint → 自动退回 FALLBACK 色板，保证融合效果永不失效
    const ImageColorExtractor = {
        _cache: {},
        // 各自然元素图片的兜底主体色（无法读取像素时使用）
        FALLBACK: {
            '日.mp4':{r:255,g:150,b:60}, '月.mp4':{r:150,g:170,b:220}, '星.mp4':{r:95,g:120,b:215},
            '云.mp4':{r:150,g:175,b:210}, '风.mp4':{r:120,g:200,b:190}, '冰.mp4':{r:150,g:210,b:230},
            '雨.mp4':{r:90,g:150,b:215}, '雪.mp4':{r:185,g:210,b:230}, '山.mp4':{r:110,g:165,b:110},
            '石.mp4':{r:155,g:140,b:120}, '水.mp4':{r:80,g:160,b:215}, '火.mp4':{r:240,g:105,b:75},
            '土.mp4':{r:185,g:135,b:90}, '地.mp4':{r:115,g:165,b:95}, '沙.mp4':{r:210,g:180,b:120},             '背景.png':{r:120,g:160,b:200},
            '背景1.jpg':{r:120,g:160,b:200},
            // 动物王国（资源位于项目根目录）视频兜底色：按文件名匹配，保证弹窗主色融合不回落默认橙
            '鼠.mp4':{r:150,g:140,b:130}, '牛.mp4':{r:130,g:100,b:75}, '虎.mp4':{r:230,g:140,b:60},
            '兔.mp4':{r:210,g:190,b:185}, '龙.mp4':{r:210,g:70,b:60},  '蛇.mp4':{r:120,g:170,b:110},
            '马.mp4':{r:170,g:110,b:70},  '羊.mp4':{r:215,g:205,b:180}, '猴.mp4':{r:160,g:120,b:80},
            '鸡.mp4':{r:225,g:120,b:60},  '狗.mp4':{r:170,g:140,b:100}, '猪.mp4':{r:225,g:160,b:160},
            '猫.mp4':{r:150,g:150,b:155}, '象.mp4':{r:140,g:150,b:160}, '熊.mp4':{r:120,g:90,b:65},
            '狮.mp4':{r:225,g:165,b:70},  '鸟.mp4':{r:110,g:160,b:210}, '鱼.mp4':{r:80,g:170,b:190}
        },
        _key(src){ try { return String(src).split('/').pop().split('?')[0]; } catch(e){ return src; } },
        _fallback(src){ return this.FALLBACK[this._key(src)] || {r:255,g:159,b:67}; },
        // 主导色算法：降采样 + 按饱和度加权，凸显彩色主体、抑制苍白背景的平均值
        _dominant(data){
            let r=0,g=0,b=0,wsum=0;
            for (let i=0;i<data.length;i+=4){
                if (data[i+3] < 125) continue;            // 跳过透明像素
                const R=data[i],G=data[i+1],B=data[i+2];
                const max=Math.max(R,G,B), min=Math.min(R,G,B);
                const s = max===0?0:(max-min)/max;        // 饱和度
                const L = (0.299*R+0.587*G+0.114*B)/255;  // 明度
                let w = s*s + 0.04;                        // 偏向彩色像素
                w *= (L>0.12 && L<0.92) ? 1 : 0.05;        // 抑制纯黑/纯白背景
                r+=R*w; g+=G*w; b+=B*w; wsum+=w;
            }
            if (wsum < 1e-6) return null;
            return rpBoost({ r:r/wsum, g:g/wsum, b:b/wsum });
        },
        extract(src){
            const key = this._key(src);
            if (this._cache[key]) return Promise.resolve(this._cache[key]);
            // 视频无法用 Image 取像素，直接走兜底色板（避免发起注定失败的图片请求）
            if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(key)) {
                const c = this._fallback(src); this._cache[key] = c; return Promise.resolve(c);
            }
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                let done = false;
                const fb = () => { const c = this._fallback(src); this._cache[key]=c; if(!done){done=true;resolve(c);} };
                img.onload = () => {
                    try {
                        const W=24,H=24;
                        const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
                        const cx = cv.getContext('2d');
                        cx.drawImage(img,0,0,W,H);
                        const d = cx.getImageData(0,0,W,H).data;   // file:// 下在此抛 SecurityError
                        const col = this._dominant(d) || this._fallback(src);
                        this._cache[key]=col; if(!done){done=true;resolve(col);}
                    } catch(e){ fb(); }
                };
                img.onerror = fb;
                img.src = src;
                setTimeout(fb, 2500);   // 兜底超时（个别环境 onload/onerror 均不触发）
            });
        }
    };

    // 模块 C：弹窗主题应用（消费「颜色」→ 写入 CSS 变量；与取色模块解耦）
    const ReadPopupTheme = {
        last: null,
        async applyForImage(popupEl, imageSrc, cfg){
            let accent = cfg.accent ? rpParseColor(cfg.accent) : null;
            if (!accent && cfg.theme && cfg.theme!=='auto' && RP_THEMES[cfg.theme]) accent = rpParseColor(RP_THEMES[cfg.theme].accent);
            if (!accent) accent = await ImageColorExtractor.extract(imageSrc);   // 自动提取图片主色
            accent = rpBoost(accent);
            const text = rpLuminance(accent) > 0.6 ? '#3a2613' : '#fff6ea';
            const vars = {
                '--rp-accent': rpRgbToCss(accent,1),
                '--rp-accent-border': rpRgbToCss(accent, cfg.borderAlpha),
                '--rp-text': text,
                '--rp-head-bg': rpRgbToCss(accent, cfg.headAlpha),
                '--rp-focus-bg': rpRgbToCss(accent, 0.30),
                '--rp-bg': 'transparent'
            };
            this.apply(popupEl, vars);
            this.last = { accent, text, vars };
            return vars;
        },
        apply(popupEl, vars){ for (const k in vars) popupEl.style.setProperty(k, vars[k]); }
    };

    // 模块 D：内容区自动上下滚动（rAF 平滑、到顶/底回弹；悬停/手动滚动暂停）
    const ReadPopupScroller = {
        el:null, raf:0, dir:1, hovering:false, idleUntil:0, cfg:null,
        start(el, cfg){
            this.stop();
            this.el = el; this.cfg = cfg; this.dir = 1; this.hovering = false; this.idleUntil = 0;
            if (cfg.scrollPauseOnHover){
                el.addEventListener('mouseenter', this._enter);
                el.addEventListener('mouseleave', this._leave);
                el.addEventListener('wheel', this._touch, {passive:true});
                el.addEventListener('touchmove', this._touch, {passive:true});
            }
            const loop = () => {
                if (!this.el) return;
                const max = this.el.scrollHeight - this.el.clientHeight;
                if (max > 6 && !this.hovering && Date.now() > this.idleUntil){
                    this.el.scrollTop += this.dir * (this.cfg.autoScrollSpeed||0.28);
                    if (this.el.scrollTop >= max){ this.el.scrollTop = max; this.dir = -1; }
                    else if (this.el.scrollTop <= 0){ this.el.scrollTop = 0; this.dir = 1; }
                }
                this.raf = requestAnimationFrame(loop);
            };
            this.raf = requestAnimationFrame(loop);
        },
        _enter(){ ReadPopupScroller.hovering = true; },
        _leave(){ ReadPopupScroller.hovering = false; },
        _touch(){ ReadPopupScroller.idleUntil = Date.now() + 2600; },
        stop(){
            if (this.raf) cancelAnimationFrame(this.raf);
            if (this.el){
                this.el.removeEventListener('mouseenter', this._enter);
                this.el.removeEventListener('mouseleave', this._leave);
                this.el.removeEventListener('wheel', this._touch);
                this.el.removeEventListener('touchmove', this._touch);
            }
            this.raf = 0; this.el = null;
        }
    };

    // 模块 E：滚动跟随高亮（段落滚动到视口中心时高亮，其余保持默认）
    const ReadPopupFocus = {
        el:null, sections:[], onScroll:null,
        init(el){
            this.stop();
            this.el = el;
            this.sections = Array.from(el.querySelectorAll('.rp-section'));
            this.onScroll = () => this._update();
            el.addEventListener('scroll', this.onScroll, {passive:true});
            this._update();
        },
        _update(){
            if (!this.sections.length || !this.el) return;
            const r = this.el.getBoundingClientRect();
            const center = r.top + r.height/2;
            let best=null, bestD=Infinity;
            for (const s of this.sections){
                const sr = s.getBoundingClientRect();
                const c = sr.top + sr.height/2;
                const d = Math.abs(c - center);
                if (d < bestD){ bestD = d; best = s; }
            }
            for (const s of this.sections) s.classList.toggle('rp-scrollfocus', s === best);
        },
        stop(){
            if (this.el && this.onScroll) this.el.removeEventListener('scroll', this.onScroll);
            this.sections = []; this.el = null; this.onScroll = null;
        }
    };

    // 对外 API：主题切换 / 外部传入主色（运行时调用，立即重算并应用到当前弹窗）
    function setReadPopupTheme(name){
        ReadPopupConfig.theme = name;
        ReadPopupConfig.accent = null;
        const popup = document.getElementById('readPopup');
        const img = (typeof currentCard !== 'undefined' && currentCard && currentCard.image) || '日.mp4';
        if (popup) ReadPopupTheme.applyForImage(popup, img, ReadPopupConfig);
    }
    function setReadPopupAccent(hex){
        ReadPopupConfig.accent = hex || null;
        ReadPopupConfig.theme = 'auto';
        const popup = document.getElementById('readPopup');
        const img = (typeof currentCard !== 'undefined' && currentCard && currentCard.image) || '日.mp4';
        if (popup) ReadPopupTheme.applyForImage(popup, img, ReadPopupConfig);
    }
    window.ReadPopupConfig = ReadPopupConfig;
    window.setReadPopupTheme = setReadPopupTheme;
    window.setReadPopupAccent = setReadPopupAccent;

    // ==================== 读一读 弹窗（小知识 / 组词 / 造句示例 + 同步朗读高亮） ====================
    // 点击「读一读」弹出阅读窗，整合 小知识 / 组词 / 造句示例，并逐段语音朗读、同步高亮当前段落。
    function closeReadPopup(){
        const p = document.getElementById('readPopup');
        if (p) p.classList.remove('show');
        ReadPopupScroller.stop();   // 停止自动滚动
        ReadPopupFocus.stop();      // 停止滚动跟随高亮
        window.speechSynthesis.cancel();
    }

    // 滚动定位：将弹窗内第 idx 个段落平滑居中到可视区（由语音发音进度调用，实现“读到哪句滚到哪句”）
    function scrollReadPopupToSection(idx){
        const popup = document.getElementById('readPopup');
        if (!popup) return;
        const sec = popup.querySelectorAll('.rp-section')[idx];
        if (!sec) return;
        const cr = popup.getBoundingClientRect();
        const ir = sec.getBoundingClientRect();
        const target = popup.scrollTop + (ir.top - cr.top) - (cr.height - ir.height) / 2;
        const t = Math.max(0, Math.min(target, popup.scrollHeight - popup.clientHeight));
        if (popup.scrollTo) popup.scrollTo({ top: t, behavior: 'smooth' });
        else popup.scrollTop = t;
    }

    function readAloud(data){
        ACTIVITY_TOKEN++; window.speechSynthesis.cancel();   // 用户主动触发：停掉旧语音与描红
        hideBlend(); blendType = null; clearLetterHL();   // 打开读一读时收起拼读浮窗并清除字母高亮，避免视觉重叠
        const body = document.getElementById('readPopupBody');
        body.innerHTML = '';
        const sections = [
            { cls:'rp-know', label:'📖 小知识',      text: (data.meaning || ''),                          read: (data.meaning || '') },
            { cls:'rp-word', label:'🔤 组词',        text: '组词：' + (data.words || []).join('、'),        read: '组词：' + (data.words || []).join('，') },
            { cls:'rp-sent', label:'✍️ 造句示例',    text: (data.sentence || ''),                          read: (data.sentence || '') }
        ];
        sections.forEach((s) => {
            const d = document.createElement('div');
            d.className = 'rp-section ' + s.cls;
            d.innerHTML = `<div class="rp-label">${s.label}</div><div class="rp-text">${s.text}</div>`;
            body.appendChild(d);
        });
        const popupEl = document.getElementById('readPopup');
        popupEl.classList.add('show');
        // 滚动跟随高亮：仅监听「手动滚动」以定位居中段落；滚动动作本身已由语音发音进度驱动，不再自动漫游
        ReadPopupFocus.init(popupEl);
        const reads = sections.map(s => s.read);
        speakQueue(reads, 'zh-CN',
            (i) => {                                   // 朗读第 i 段前：高亮该段，并平滑滚动定位到该段（语音读到哪句，就滚动到哪句）
                for (let k = 0; k < body.children.length; k++) body.children[k].classList.toggle('active', k === i);
                scrollReadPopupToSection(i);
            },
            () => {                                     // 全部读完：取消语音高亮，保留内容供回顾
                for (let k = 0; k < body.children.length; k++) body.children[k].classList.remove('active');
            }
        );
    }

    // ==================== 笔画类型判定 + 左侧笔画名称高亮 ====================
    // 笔画类型：含 折/钩/弯/斜/卧 等折笔特征者归为「折画（复合笔画）」，其余归为「基本笔画」。
    function strokeType(name){
        if (/[折钩弯斜卧]/.test(name)) return '折画';
        return '基本';
    }
    // 高亮 / 取消高亮 背面笔画名称列表中第 i 笔（笔顺动画 / 描红 / 重播 同步）
    function hlStroke(i){
        const list = document.querySelector('#ui-strokes .stroke-list');
        if (!list) return;
        const chips = list.children;
        for (let k = 0; k < chips.length; k++) chips[k].classList.toggle('active', k === i);
        // 讲到 / 写到哪一笔，就平滑滚动到对应笔画位置（仅在点击按钮读取/书写时触发，无空闲自动滚动）
        const sc = document.getElementById('ui-strokes');   // 即 .strokes-side 滚动容器
        const chip = chips[i];
        if (sc && chip){
            const cr = sc.getBoundingClientRect();
            const ir = chip.getBoundingClientRect();
            const target = sc.scrollTop + (ir.top - cr.top) - (sc.clientHeight - ir.height) / 2;
            const t = Math.max(0, Math.min(target, sc.scrollHeight - sc.clientHeight));
            if (sc.scrollTo) sc.scrollTo({ top: t, behavior: 'smooth' });
            else sc.scrollTop = t;
        }
    }
    function clearStrokeHL(){
        const list = document.querySelector('#ui-strokes .stroke-list');
        if (!list) return;
        const chips = list.children;
        for (let k = 0; k < chips.length; k++) chips[k].classList.remove('active');
    }

    // 兜底：隐藏描写引导弹窗（v1.15.0 已移除弹窗，此函数保留以兼容旧调用，安全空操作）
    function hideTraceGuidePop(){
        const pop = document.getElementById('traceGuidePop');
        if (pop) pop.classList.remove('show');
    }

    // ==================== 笔顺透明弹窗（左侧视频区）显隐 ====================
    // ==================== 笔顺动画（逐笔播放 + 同步高亮） ====================
    // 替代原 animateCharacter 整体动画：逐笔演示黑色笔顺，并同步高亮左侧对应笔画名称。
    async function playStrokeAnim(data){
        const myAct = ++ACTIVITY_TOKEN;
        window.speechSynthesis.cancel();
        resetTraceWriter(data);   // 清掉蓝色笔迹，确保黑色笔顺动画清晰可见
        if (!baseWriter) return;
        if (traceQuizActive) try { traceWriter.cancelQuiz(); } catch(ex){}
        traceQuizActive = false;
        const total = data.strokes || (data.strokesName || []).length || 0;
        try { baseWriter.showCharacter(); } catch(e){}
        await sleep(150); if (myAct !== ACTIVITY_TOKEN) return;
        for (let i = 0; i < total; i++) {
            if (myAct !== ACTIVITY_TOKEN) return;
            hlStroke(i);
            try { baseWriter.animateStroke(i, { duration: 600 }); } catch(e){}
            await sleep(680);
        }
        clearStrokeHL();
        if (myAct !== ACTIVITY_TOKEN) return;
        speakAudio(`这是「${data.char}」字的笔顺`);
    }

    // ==================== 手动描红练习（带语音笔顺提示，可反复） ====================
    function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
    // 创建双层田字格（黑色笔顺参考 + 蓝色手写描红），从 openModal 抽取以便加载失败时可重试
    function createTzgWriters(data) {
        if (typeof HanziWriter === 'undefined') { console.warn('HanziWriter 未加载，跳过田字格渲染'); return; }
        // 仅清空两个子层（保留 #tzg-base / #tzg-trace 容器本身），避免把描红目标节点删掉
        const baseEl = document.getElementById('tzg-base');
        const traceEl = document.getElementById('tzg-trace');
        if (baseEl) baseEl.innerHTML = '';
        if (traceEl) traceEl.innerHTML = '';
        // 双层田字格：尺寸与容器一致（移动端 160 / 桌面 190）
        const tzgSize = (window.innerWidth <= 600) ? 160 : 190;
        traceCompleted = false;
        traceQuizActive = false;
        // 底层：黑色笔顺动画 / 字形参考
        baseWriter = HanziWriter.create('tzg-base', data.char, {
            width: tzgSize, height: tzgSize, padding: 10,
            strokeColor: '#333333',      // 黑色笔划（笔顺动画 / 字形参考）
            // 独体字整体即部首，参考字保持黑色；合体字仅把部首高亮为红，符合“黑色笔顺动画/字形参考”设计
            radicalColor: (data.structure && data.structure.indexOf('独体') >= 0) ? '#333333' : '#ff6b6b',
            strokeWidth: TRACE_WIDTH,    // 与蓝色手写笔划同宽
            delayBetweenStrokes: 200,
            showOutline: true,
            outlineColor: '#d0d0d0',
            charDataLoader: window.__hanziDataLoader   // 读取本地笔画数据，零外链
        });
        // 上层：蓝色手写描红（完成笔画仍保持蓝色，且永不随动画被清除）
        traceWriter = HanziWriter.create('tzg-trace', data.char, {
            width: tzgSize, height: tzgSize, padding: 10,
            strokeColor: '#1e88e5',      // 完成笔画保持蓝色
            drawingColor: '#1e88e5',     // 书写中笔迹蓝色
            strokeWidth: TRACE_DRAW_WIDTH,    // 蓝笔明显加粗（手动描红轨迹更清晰）
            drawingWidth: TRACE_DRAW_WIDTH,   // 蓝笔明显加粗
            showOutline: false,          // 不重复画轮廓，仅呈现用户蓝色笔迹
            showCharacter: false,        // 关键修复：默认不渲染蓝色字，蓝色仅在手动书写(quiz)时出现，不遮挡田字格
            outlineColor: '#d0d0d0',
            charDataLoader: window.__hanziDataLoader   // 读取本地笔画数据，零外链
        });
        // 书写临摹测验及通关联动（自由书写保留蓝色轨迹）
        enableQuiz(data);
        applyTzgCentering();   // 等字形数据加载后把字符平移到田字格正中
    }

    // 田字格状态层：加载中 / 依赖加载失败提示（不再静默失效，便于线上排查 libs/ 缺失等问题）
    function setTzgStatus(msg, isError, onClick) {
        const el = document.getElementById('tzg-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'tzg-status' + (isError ? ' tzg-status-error' : '');
        el.style.display = 'flex';
        if (onClick) { el.style.cursor = 'pointer'; el.onclick = onClick; }
        else { el.style.cursor = 'default'; el.onclick = null; }
    }
    function clearTzgStatus() {
        const el = document.getElementById('tzg-status');
        if (!el) return;
        el.style.display = 'none';
        el.onclick = null;
    }

    // 自由书写（临摹测验）：用户在蓝色层描红，笔迹（drawingColor 蓝色）持久保留，不被任何动画清除
    function enableQuiz(data){
        const tzg = document.getElementById('tzg-trace');
        tzg.onclick = () => {
            if (traceCompleted) return;   // 已写完：保留蓝迹，不再重置/清除
            if (traceQuizActive) return;  // 进行中：不重复开启
            hideTraceGuidePop();          // 宝宝开始动笔，收起鼓励引导弹窗
            try {
                traceQuizActive = true;
                traceWriter.quiz({
                    // 写到第几笔，就高亮并滚动到对应笔画位置（与讲解同步）
                    onCorrectStroke: (sd) => { if (sd && typeof sd.strokeNum === 'number') hlStroke(sd.strokeNum); },
                    // 书写不正确或顺序有误：高亮当前笔并简洁语音提醒（节流，避免连续误触反复播报）
                    onMistake: (sd) => {
                        if (sd && typeof sd.strokeNum === 'number') hlStroke(sd.strokeNum);
                        const now = Date.now();
                        if (now - lastMistakeSpeak > 1800) {
                            lastMistakeSpeak = now;
                            speakAudio('这一笔再试试');
                        }
                    },
                    onComplete: () => {
                        // 写对后保留用户蓝色笔迹，不重新初始化/清除田字格
                        traceCompleted = true;
                        traceQuizActive = false;
                        speakAudio(`太棒了！你写对了「${data.char}」字！真厉害！`);
                        triggerConfetti();
                        showRandomBadge();
                    }
                });
            } catch(e){ traceQuizActive = false; }
        };
    }
    // 描红练习：点击后直接进入书写模式（不弹窗、不逐笔讲解），仅一句简洁语音提示。
    // ACTIVITY_TOKEN：用户点击其它按钮时自增，本循环据此在每笔之间安全退出，互不干扰。
    // 保留灰色虚线引导轮廓，宝宝可立即点击田字格开始自由书写（蓝迹持久保留）。
    async function tracePractice(data){
        // 依赖未就绪（libs/ 未部署到 GitHub 等）：给出提示而非抛错，避免控制台报错
        if (typeof HanziWriter === 'undefined' || !window.__HANZI_DATA__) {
            setTzgStatus('笔画组件未加载，点此重试', true, () => { _hwPromise = null; openModal(data); });
            showDeployWarning(criticalMissingHint());
            return;
        }
        const myAct = ++ACTIVITY_TOKEN;       // 占用活动令牌，取消任何进行中的描红/朗读
        window.speechSynthesis.cancel();
        resetTraceWriter(data);   // 清掉旧蓝色笔迹，支持反复练习
        const total = data.strokes || (data.strokesName || []).length || 0;
        if (myAct !== ACTIVITY_TOKEN) return;
        // 直接进入书写模式（不弹窗、不逐笔讲解）：保留灰色虚线引导轮廓，宝宝可立即描红
        try { baseWriter.showOutline(); baseWriter.hideCharacter(); } catch(e){}
        enableQuiz(data);   // 直接开启自由书写
        // 简洁语音提示（仅一句，不干扰书写）
        if (myAct === ACTIVITY_TOKEN) speakAudio(`描一描「${data.char}」字`);
    }

    // 重置蓝色手写层（清除旧蓝色笔迹、重建 traceWriter，支持反复练习）
    function resetTraceWriter(data){
        const traceEl = document.getElementById('tzg-trace');
        if (traceEl) traceEl.innerHTML = '';
        const tzgSize = (window.innerWidth <= 600) ? 160 : 190;
        try {
            traceWriter = HanziWriter.create('tzg-trace', data.char, {
                width: tzgSize, height: tzgSize, padding: 10,
                strokeColor: '#1e88e5', drawingColor: '#1e88e5',
                strokeWidth: TRACE_DRAW_WIDTH, drawingWidth: TRACE_DRAW_WIDTH,
                showOutline: false, showCharacter: false, outlineColor: '#d0d0d0',
                charDataLoader: window.__hanziDataLoader   // 读取本地笔画数据，零外链
            });
        } catch(e){}
        traceCompleted = false; traceQuizActive = false;
        applyTzgCentering();   // 重建蓝色描红层后同步 viewBox，确保与参考字对齐居中
    }
    // 描红讲解（仅语音 + 逐笔演示，不开自由书写；可反复点击）
    async function traceGuide(data){
        // 依赖未就绪（libs/ 未部署到 GitHub 等）：给出提示而非抛错，避免控制台报错
        if (typeof HanziWriter === 'undefined' || !window.__HANZI_DATA__) {
            setTzgStatus('笔画组件未加载，点此重试', true, () => { _hwPromise = null; openModal(data); });
            showDeployWarning(criticalMissingHint());
            return;
        }
        const myAct = ++ACTIVITY_TOKEN;
        window.speechSynthesis.cancel();
        const names = data.strokesName || [];
        const total = data.strokes || names.length || 0;
        resetTraceWriter(data);   // 清掉旧蓝色笔迹，保证讲解画面干净
        try { baseWriter.hideCharacter(); } catch(e){}
        await sleep(300);
        if (myAct !== ACTIVITY_TOKEN) return;
        await speakQueue(['现在讲解「' + data.char + '」字的写法，一共' + total + '笔，跟我一笔一笔看。']);
        for (let i = 0; i < total; i++) {
            if (myAct !== ACTIVITY_TOKEN) return;
            const name = names[i] || ('第' + (i+1) + '笔');
            hlStroke(i);   // 同步高亮左侧当前笔画名称
            await speakQueue(['第' + (i+1) + '笔，' + name + '。'], 'zh-CN');
            if (myAct !== ACTIVITY_TOKEN) return;
            try { baseWriter.animateStroke(i, { duration: 800 }); } catch(e){}
            await sleep(850);
        }
        clearStrokeHL();
        if (myAct !== ACTIVITY_TOKEN) return;
        await speakQueue(['「' + data.char + '」字讲解完了，点「描红练习」用蓝笔描一描吧！']);
        try { baseWriter.showOutline(); } catch(e){}
        enableQuiz(data);
    }

    // ==================== 撒花庆祝特效 ====================
    function triggerConfetti() {
        // 撒花特效库按需懒加载（首次问答完成时），未加载则静默跳过，不影响主流程
        ensureConfetti().then(runConfetti).catch(() => {});
    }
    function runConfetti() {
        if (typeof confetti === 'undefined') return;
        const duration = 2.8 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 9999,
            colors: ['#ffd54f', '#ff6b6b', '#4da8da', '#66bb6a', '#ab47bc', '#ff9f43']
        };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, {
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            }));
            confetti(Object.assign({}, defaults, {
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            }));
        }, 250);
    }

    // ==================== 随机掉落奖励徽章 ====================
    function showRandomBadge() {
        const badge = document.getElementById('badge-reward');
        const iconDiv = badge.querySelector('.badge-icon');
        const textDiv = badge.querySelector('.badge-text');

        const randomReward = rewardLibrary[Math.floor(Math.random() * rewardLibrary.length)];
        iconDiv.innerText = randomReward.icon;
        textDiv.innerText = randomReward.text;

        // 重置动画状态触发重新播放
        badge.classList.remove('show-badge');
        void badge.offsetWidth; // 强制reflow
        badge.classList.add('show-badge');
    }

    // ==================== 趣味问答（游戏化测验） ====================
    // 题型：为当前汉字选出正确的拼音（四选一）
    function startQuiz(data) {
        const box = document.getElementById('quizBox');
        const qEl = document.getElementById('quizQuestion');
        const optEl = document.getElementById('quizOptions');
        const fbEl = document.getElementById('quizFeedback');

        fbEl.textContent = '';
        fbEl.className = 'quiz-feedback';

        qEl.innerHTML = `请为汉字 <b style="font-size:1.5em;color:#d81b60;padding:0 4px;">${data.char}</b> 选择正确的拼音：`;

        // 从当前场景其余汉字中抽取3个不重复的干扰拼音
        const currentData = (SCENE_CONFIG[currentScene] || {}).data || literacyData;
        const others = currentData
            .filter(d => d.char !== data.char && d.pinyin !== data.pinyin)
            .map(d => d.pinyin);
        shuffle(others);
        const distractors = others.slice(0, 3);
        const options = shuffle([data.pinyin, ...distractors]);

        optEl.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('div');
            btn.className = 'quiz-option';
            btn.textContent = opt;
            btn.onclick = (e) => {
                e.stopPropagation();
                // 锁定选项，防止重复点击
                optEl.querySelectorAll('.quiz-option').forEach(b => b.onclick = null);
                if (opt === data.pinyin) {
                    btn.classList.add('correct');
                    fbEl.textContent = '🎉 答对啦！你真棒！';
                    fbEl.className = 'quiz-feedback ok';
                    speakAudio(`答对啦！${data.char}的拼音是${data.pinyin}，你真聪明！`);
                    triggerConfetti();
                    showRandomBadge();
                } else {
                    btn.classList.add('wrong');
                    fbEl.textContent = '💡 再想想哦，点「听一听」找答案~';
                    fbEl.className = 'quiz-feedback no';
                    speakAudio(`${data.char}的拼音是${data.pinyin}，我们再来一次！`);
                }
            };
            optEl.appendChild(btn);
        });

        box.classList.add('show');
    }

    // Fisher–Yates 洗牌
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // 收起趣味问答面板
    document.getElementById('quizClose').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('quizBox').classList.remove('show');
    });
    
