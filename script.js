/* =========================================
   設定
   ========================================= */

// 初期表示・パン範囲に使う、マップの描画範囲（SVG座標。下部の余白を除く）
const MAP_BOUNDS = { x: 0, y: 15, width: 851, height: 460 };

// 最大ズーム（画面1pxあたりのSVG座標の倍率）
const MAX_SCALE = 12;
// ズーム倍率（画面1px あたりの SVG 座標単位）がこの値以上になったら表示するグループ
// 文字が小さいグループほど、拡大しないと表示しない
const LOD_RULES = {
    '_x32_0_x5F_Parkingname': 0.9,
    '_x35_0_x5F_Frags': 0.9,
    '_x35_1_x5F_Frags': 0.9,
    '_x35_2_x5F_Frags': 0.9,
    '_x35_3_x5F_Frags': 0.9,
    '_x35_4_x5F_Frags': 0.9,
    '_x35_5_x5F_Frags': 0.9,
    '_x35_6_x5F_Frags': 0.9,
    '_x31_5_x5F_SubCoursename': 1.4,
    '_x31_8_x5F_Streetname': 2.0,
    '_x31_7_x5F_Buildingname': 2.0,
    '_x31_4_x5F_Objectsname': 2.0,
    '_x32_5_x5F_Orangename': 2.8,
    '_x32_7_x5F_Banarname': 2.8,
};

// ウェブアプリ用：オフラインでも開けるよう Service Worker を登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service Worker の登録に失敗しました', error));
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('map-container');

    try {
        await loadSvg(container);
    } catch (error) {
        console.error(error);
        container.querySelector('.map-status').textContent =
            'マップを読み込めませんでした。ローカルで確認する場合は、ファイルを直接開かずにサーバー経由（例: npx serve）で開いてください。';
        return;
    }

    const map = setupPanZoom(container);
    setupToggles(map);
});

/* =========================================
   SVGの読み込み（images/ のファイルをそのまま差し込む）
   ========================================= */
async function loadSvg(container) {
    const response = await fetch(container.dataset.src);
    if (!response.ok) {
        throw new Error(`SVGの読み込みに失敗しました: ${response.status}`);
    }

    const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    const svg = doc.documentElement;
    if (svg.nodeName !== 'svg') {
        throw new Error('SVGの解析に失敗しました');
    }

    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    container.replaceChildren(document.importNode(svg, true));
}

/* =========================================
   ズーム・パン（viewBox を書き換えて拡大縮小する）
   ========================================= */
function setupPanZoom(container) {
    const svg = container.querySelector('svg');
    const hint = document.querySelector('.map-hint');
    const zoomInButton = document.querySelector('[data-zoom="in"]');
    const zoomOutButton = document.querySelector('[data-zoom="out"]');

    // 表示状態: scale = 画面1pxあたりの倍率, (cx, cy) = 表示中心のSVG座標
    const view = { scale: 1, cx: 0, cy: 0 };
    let width = container.clientWidth;
    let height = container.clientHeight;
    let hasInteracted = false;
    let animationId = null;

    const lodGroups = Object.entries(LOD_RULES)
        .map(([id, minScale]) => ({ element: svg.getElementById(id), minScale }))
        .filter(group => group.element);

    const fitScale = () => Math.min(width / MAP_BOUNDS.width, height / MAP_BOUNDS.height);
    const clampScale = scale => Math.min(Math.max(scale, fitScale()), Math.max(MAX_SCALE, fitScale()));

    // 表示範囲がマップの外に出ないよう中心を制限する
    function clampCenter() {
        const viewWidth = width / view.scale;
        const viewHeight = height / view.scale;
        // 表示範囲がマップより大きいときは、マップが表示範囲からはみ出さない範囲で動かせる
        const clampAxis = (center, start, size, viewSize) => {
            const min = Math.min(start + viewSize / 2, start + size - viewSize / 2);
            const max = Math.max(start + viewSize / 2, start + size - viewSize / 2);
            return Math.min(Math.max(center, min), max);
        };

        view.cx = clampAxis(view.cx, MAP_BOUNDS.x, MAP_BOUNDS.width, viewWidth);
        view.cy = clampAxis(view.cy, MAP_BOUNDS.y, MAP_BOUNDS.height, viewHeight);
    }

    function render() {
        // 非表示タブなどでサイズが 0 のときは描画しない（ResizeObserver で後から描画される）
        if (!width || !height) return;
        view.scale = clampScale(view.scale);
        clampCenter();

        const viewWidth = width / view.scale;
        const viewHeight = height / view.scale;
        svg.setAttribute('viewBox',
            `${view.cx - viewWidth / 2} ${view.cy - viewHeight / 2} ${viewWidth} ${viewHeight}`);

        lodGroups.forEach(({ element, minScale }) => {
            element.classList.toggle('lod-hidden', view.scale < minScale);
        });

        zoomInButton.disabled = view.scale >= MAX_SCALE - 0.001;
        zoomOutButton.disabled = view.scale <= fitScale() + 0.001;
    }

    // 全体表示：縦長の画面では地図を上に寄せ、下の空きにボタン類が来るようにする
    function fitTarget() {
        const scale = fitScale();
        return {
            scale,
            cx: MAP_BOUNDS.x + MAP_BOUNDS.width / 2,
            cy: MAP_BOUNDS.y + height / scale / 2,
        };
    }

    function fit() {
        Object.assign(view, fitTarget());
        render();
    }

    // 画面上の点 (px, py) を中心に factor 倍ズームする
    function zoomAt(px, py, factor) {
        const worldX = view.cx + (px - width / 2) / view.scale;
        const worldY = view.cy + (py - height / 2) / view.scale;
        view.scale = clampScale(view.scale * factor);
        view.cx = worldX - (px - width / 2) / view.scale;
        view.cy = worldY - (py - height / 2) / view.scale;
    }

    function panBy(dx, dy) {
        view.cx -= dx / view.scale;
        view.cy -= dy / view.scale;
    }

    // ボタン・ダブルタップ用のなめらかなズーム
    function animateZoom(px, py, factor) {
        const start = { ...view };
        zoomAt(px, py, factor);
        render();
        const end = { ...view };
        Object.assign(view, start);
        animateTo(end);
    }

    function animateTo(end) {
        cancelAnimationFrame(animationId);
        const start = { ...view };
        const startTime = performance.now();
        const step = now => {
            const t = Math.min((now - startTime) / 220, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            // 拡大率は対数で補間すると自然に見える
            view.scale = start.scale * Math.pow(end.scale / start.scale, ease);
            view.cx = start.cx + (end.cx - start.cx) * ease;
            view.cy = start.cy + (end.cy - start.cy) * ease;
            render();
            if (t < 1) animationId = requestAnimationFrame(step);
        };
        animationId = requestAnimationFrame(step);
    }

    function markInteracted() {
        if (hasInteracted) return;
        hasInteracted = true;
        hint?.classList.add('is-faded');
    }

    const localPoint = event => {
        const rect = container.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    // --- ドラッグ・ピンチ（Pointer Events） ---
    const pointers = new Map();
    let lastGesture = null; // { x, y, distance }
    let tapStart = null;
    let lastTap = null;

    function gestureFromPointers() {
        const points = [...pointers.values()];
        if (points.length === 1) {
            return { x: points[0].x, y: points[0].y, distance: 0 };
        }
        const [a, b] = points;
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            distance: Math.hypot(a.x - b.x, a.y - b.y),
        };
    }

    container.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        cancelAnimationFrame(animationId);
        container.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, localPoint(event));
        lastGesture = gestureFromPointers();
        tapStart = pointers.size === 1 ? { ...lastGesture, time: performance.now() } : null;
        container.classList.add('is-dragging');
    });

    container.addEventListener('pointermove', event => {
        if (!pointers.has(event.pointerId)) return;
        event.preventDefault();
        pointers.set(event.pointerId, localPoint(event));

        const gesture = gestureFromPointers();
        if (pointers.size >= 2 && lastGesture.distance > 0) {
            zoomAt(gesture.x, gesture.y, gesture.distance / lastGesture.distance);
        }
        panBy(gesture.x - lastGesture.x, gesture.y - lastGesture.y);
        lastGesture = gesture;

        if (tapStart && Math.hypot(gesture.x - tapStart.x, gesture.y - tapStart.y) > 6) {
            tapStart = null;
            markInteracted();
        }
        render();
    });

    function endPointer(event) {
        if (!pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        lastGesture = pointers.size ? gestureFromPointers() : null;
        if (!pointers.size) container.classList.remove('is-dragging');

        // ダブルタップ（ダブルクリック）で2倍に拡大
        if (event.type === 'pointerup' && tapStart && !pointers.size) {
            const now = performance.now();
            if (lastTap && now - lastTap.time < 300 && Math.hypot(tapStart.x - lastTap.x, tapStart.y - lastTap.y) < 30) {
                markInteracted();
                animateZoom(tapStart.x, tapStart.y, 2);
                lastTap = null;
            } else {
                lastTap = { x: tapStart.x, y: tapStart.y, time: now };
            }
        }
        tapStart = null;
    }

    container.addEventListener('pointerup', endPointer);
    container.addEventListener('pointercancel', endPointer);

    // --- ホイール・トラックパッドのピンチ ---
    container.addEventListener('wheel', event => {
        event.preventDefault();
        cancelAnimationFrame(animationId);
        markInteracted();
        const point = localPoint(event);
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        // トラックパッドのピンチ（ctrlKey付き）は感度を上げる
        zoomAt(point.x, point.y, Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)));
        render();
    }, { passive: false });

    // 古い iOS Safari のページ拡大ジェスチャーを止める
    container.addEventListener('gesturestart', event => event.preventDefault());

    // --- ズームボタン ---
    document.querySelectorAll('.zoom-btn').forEach(button => {
        button.addEventListener('click', () => {
            markInteracted();
            const action = button.dataset.zoom;
            if (action === 'fit') {
                animateTo(fitTarget());
                return;
            }
            animateZoom(width / 2, height / 2, action === 'in' ? 1.6 : 1 / 1.6);
        });
    });

    // --- 全画面表示（地図だけを画面いっぱいに表示） ---
    const fullscreenButton = document.querySelector('[data-fullscreen]');

    function setFullscreen(isFullscreen) {
        document.body.classList.toggle('is-map-fullscreen', isFullscreen);
        fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
        fullscreenButton.setAttribute('aria-label', isFullscreen ? '全画面を終了' : '全画面で表示');
    }

    fullscreenButton.addEventListener('click', () => {
        markInteracted();
        setFullscreen(!document.body.classList.contains('is-map-fullscreen'));
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setFullscreen(false);
    });

    // --- 画面サイズ・向きの変更 ---
    function handleResize() {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        if (newWidth === width && newHeight === height) return;
        // 操作前なら全体表示を保ち、操作後は同じ場所・同じ縮尺を保つ
        const wasFit = view.scale <= fitScale() + 0.001;
        width = newWidth;
        height = newHeight;
        if (!hasInteracted || wasFit) {
            fit();
        } else {
            render();
        }
    }

    new ResizeObserver(handleResize).observe(container);
    window.addEventListener('resize', handleResize);

    fit();

    return {
        // 指定したグループが、今のズームでは小さすぎて隠れているか
        isHiddenByZoom: id => lodGroups.some(group => group.element.id === id && view.scale < group.minScale),
    };
}

/* =========================================
   トグルボタンによる表示切り替え
   ========================================= */
function setupToggles(map) {
    const toast = document.querySelector('.map-toast');
    let toastTimer = null;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2000);
    }

    // 制御対象のSVG IDリストを 'data-target-id' 属性から取得し、表示・非表示を切り替える
    function applyCheckbox(checkbox) {
        const targetIds = checkbox.dataset.targetId.split(',').map(id => id.trim());

        targetIds.forEach(id => {
            const targetElement = document.getElementById(id);
            if (targetElement) {
                targetElement.classList.toggle('is-hidden', !checkbox.checked);
            } else {
                // IDが見つからない場合はコンソールに警告を表示（デバッグ用）
                console.warn(`SVG要素が見つかりません: ID=${id}`);
            }
        });

        return targetIds;
    }

    const targetCheckboxes = document.querySelectorAll('.control-panel input[data-target-id]');
    const flagCheckboxes = [...document.querySelectorAll('.control-panel input[data-flag]')];
    const flagAllCheckbox = document.querySelector('.control-panel input[data-flag-all]');

    const syncFlagAll = () => {
        flagAllCheckbox.checked = flagCheckboxes.some(checkbox => checkbox.checked);
    };

    targetCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const targetIds = applyCheckbox(checkbox);
            if (checkbox.dataset.flag !== undefined) syncFlagAll();

            // ONにしたのに、ズームが足りずに見えない場合は案内する
            if (checkbox.checked && targetIds.some(id => map.isHiddenByZoom(id))) {
                showToast('拡大すると表示されます');
            }
        });

        // --- 初期状態の反映 ---
        applyCheckbox(checkbox);
    });

    // 「フラッグ」はコース別フラッグをまとめて切り替える
    flagAllCheckbox.addEventListener('change', () => {
        flagCheckboxes.forEach(checkbox => {
            checkbox.checked = flagAllCheckbox.checked;
            applyCheckbox(checkbox);
        });
        if (flagAllCheckbox.checked && flagCheckboxes.some(cb => map.isHiddenByZoom(cb.dataset.targetId))) {
            showToast('拡大すると表示されます');
        }
    });
    syncFlagAll();
}
