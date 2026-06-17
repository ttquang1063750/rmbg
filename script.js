/**
 * Vanilla JavaScript implementation for Background Remover
 */

document.addEventListener('DOMContentLoaded', () => {
    // State
    let state = {
        image: null,
        tolerance: 30,
        feather: 2,
        shrink: 0,
        despill: false,
        floodFill: false,
        targetColor: { r: 255, g: 255, b: 255 },
        format: 'png',
        // active mode: null | 'pipette' | 'zoom' | 'crop'
        mode: null,
        originalFileName: 'removed-background',
        cropRect: null,
        activeHandle: null,
        dragStart: null,
        zoomLevel: 1,
        panX: 0,
        panY: 0,
    };

    // Elements
    const uploadSection = document.getElementById('upload-section');
    const fileInput = document.getElementById('file-input');
    const editorLayout = document.getElementById('editor-layout');
    const mainCanvas = document.getElementById('main-canvas');
    const magCanvas = document.getElementById('mag-canvas');
    const magnifierEl = document.getElementById('magnifier');
    const previewContainer = document.getElementById('preview-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const cropSelection = document.getElementById('crop-selection');
    const cropDimensions = document.getElementById('crop-dimensions');

    const inputTolerance = document.getElementById('input-tolerance');
    const inputFeather = document.getElementById('input-feather');
    const inputShrink = document.getElementById('input-shrink');
    const inputDespill = document.getElementById('input-despill');
    const inputFlood = document.getElementById('input-flood');
    const inputColorHex = document.getElementById('input-color-hex');
    const valTolerance = document.getElementById('val-tolerance');
    const valFeather = document.getElementById('val-feather');
    const valShrink = document.getElementById('val-shrink');

    const selectFormat = document.getElementById('select-format');
    const btnDownload = document.getElementById('btn-download');
    const txtDownload = document.getElementById('txt-download');
    const btnReset = document.getElementById('btn-reset');
    const btnToggleCrop = document.getElementById('btn-toggle-crop');
    const btnToggleZoom = document.getElementById('btn-toggle-zoom');
    const btnApplyCrop = document.getElementById('btn-apply-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const cropConfirmActions = document.getElementById('crop-confirm-actions');
    const btnPipette = document.getElementById('btn-pipette');

    // Worker
    const worker = new Worker('worker.js');

    worker.onmessage = (e) => {
        const { imageData } = e.data;
        const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
        ctx.putImageData(imageData, 0, 0);
        loadingOverlay.style.display = 'none';
    };

    // --- Upload Logic ---
    uploadSection.onclick = () => fileInput.click();

    fileInput.onchange = (e) => handleFile(e.target.files[0]);

    uploadSection.ondragover = (e) => {
        e.preventDefault();
        uploadSection.classList.add('dragging');
    };
    uploadSection.ondragleave = () => uploadSection.classList.remove('dragging');
    uploadSection.ondrop = (e) => {
        e.preventDefault();
        uploadSection.classList.remove('dragging');
        handleFile(e.dataTransfer.files[0]);
    };

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;

        state.originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || 'removed-background';
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                state.image = img;
                uploadSection.style.display = 'none';
                editorLayout.style.display = 'flex';
                detectInitialColor(img);
                requestProcessing();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function detectInitialColor(img) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        state.targetColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
        updateColorUI();
    }

    // --- Processing Logic ---
    let processTimer = null;
    function requestProcessing() {
        clearTimeout(processTimer);
        processTimer = setTimeout(() => {
            if (!state.image) return;
            loadingOverlay.style.display = 'flex';

            mainCanvas.width = state.image.width;
            mainCanvas.height = state.image.height;
            const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            ctx.drawImage(state.image, 0, 0);

            const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
            worker.postMessage({
                imageData,
                targetColor: state.targetColor,
                tolerance: state.tolerance,
                feather: state.feather,
                shrink: state.shrink,
                despill: state.despill,
                floodFill: state.floodFill
            }, [imageData.data.buffer]);
        }, 50);
    }

    // --- Mode Management ---
    function setMode(newMode) {
        const prev = state.mode;

        // Tắt mode cũ
        if (prev === 'crop') exitCropMode();
        if (prev === 'pipette') {
            btnPipette.classList.remove('active');
            magnifierEl.classList.remove('visible'); magnifierEl.style.display = 'none';
        }
        if (prev === 'zoom') {
            btnToggleZoom.classList.remove('active');
        }

        state.mode = (prev === newMode) ? null : newMode;

        // Bật mode mới
        if (state.mode === 'pipette') {
            btnPipette.classList.add('active');
        }
        if (state.mode === 'zoom') {
            btnToggleZoom.classList.add('active');
        }
        if (state.mode === 'crop') {
            enterCropMode();
        }

        updateCursor();
    }

    function updateCursor() {
        if (state.mode === 'pipette') {
            mainCanvas.style.cursor = 'crosshair';
        } else if (state.mode === 'zoom') {
            mainCanvas.style.cursor = state.zoomLevel > 1 ? 'grab' : 'zoom-in';
        } else {
            mainCanvas.style.cursor = 'default';
        }
    }

    // --- Magnifier ---
    function updateMagnifier(clientX, clientY, isTouch = false) {
        const canvasRect = mainCanvas.getBoundingClientRect();
        const contRect = previewContainer.getBoundingClientRect();
        const scaleX = mainCanvas.width / canvasRect.width;
        const scaleY = mainCanvas.height / canvasRect.height;
        const cx = clientX - canvasRect.left;
        const cy = clientY - canvasRect.top;

        const magCtx = magCanvas.getContext('2d', { willReadFrequently: true });
        magCtx.clearRect(0, 0, 180, 180);
        magCtx.drawImage(mainCanvas, cx * scaleX - 30, cy * scaleY - 30, 60, 60, 0, 0, 180, 180);

        const mx = clientX - contRect.left;
        const my = clientY - contRect.top;
        // Trên touch: hiện magnifier phía trên ngón tay để không bị che
        const fingerOffset = isTouch ? 160 : 90;
        const left = Math.max(0, Math.min(contRect.width - 180, mx - 90));
        const top = Math.max(0, my - fingerOffset);
        magnifierEl.style.left = left + 'px';
        magnifierEl.style.top = top + 'px';
        magnifierEl.classList.add('visible');
        magnifierEl.style.display = 'block';
    }

    function pickColorAt(clientX, clientY) {
        const canvasRect = mainCanvas.getBoundingClientRect();
        if (clientX < canvasRect.left || clientX > canvasRect.right ||
            clientY < canvasRect.top || clientY > canvasRect.bottom) return;
        const scaleX = mainCanvas.width / canvasRect.width;
        const scaleY = mainCanvas.height / canvasRect.height;
        const x = (clientX - canvasRect.left) * scaleX;
        const y = (clientY - canvasRect.top) * scaleY;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = state.image.width;
        tempCanvas.height = state.image.height;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(state.image, 0, 0);
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        state.targetColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
        updateColorUI();
        requestProcessing();
    }

    // --- Controls Event Handlers ---
    inputTolerance.oninput = (e) => {
        state.tolerance = parseInt(e.target.value);
        valTolerance.innerText = state.tolerance;
        requestProcessing();
    };

    inputFeather.oninput = (e) => {
        state.feather = parseInt(e.target.value);
        valFeather.innerText = state.feather;
        requestProcessing();
    };

    inputShrink.oninput = (e) => {
        state.shrink = parseInt(e.target.value);
        valShrink.innerText = state.shrink;
        requestProcessing();
    };

    inputDespill.onchange = (e) => {
        state.despill = e.target.checked;
        requestProcessing();
    };

    inputFlood.onchange = (e) => {
        state.floodFill = e.target.checked;
        requestProcessing();
    };

    if (inputColorHex) {
        inputColorHex.oninput = (e) => {
            const hex = e.target.value.trim();
            if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return;
            state.targetColor = {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
            updateColorUI();
            requestProcessing();
        };
    }

    selectFormat.onchange = (e) => {
        state.format = e.target.value;
        txtDownload.innerText = `Tải về ${state.format.toUpperCase()}`;
    };

    btnDownload.onclick = () => {
        const link = document.createElement('a');
        link.download = `${state.originalFileName}.${state.format}`;
        link.href = mainCanvas.toDataURL(`image/${state.format}`);
        link.click();
    };

    btnReset.onclick = () => {
        state.image = null;
        state.mode = null;
        state.cropRect = null;
        state.zoomLevel = 1;
        state.panX = 0;
        state.panY = 0;
        uploadSection.style.display = 'flex';
        editorLayout.style.display = 'none';
        fileInput.value = '';
        cropSelection.style.display = 'none';
        cropConfirmActions.style.display = 'none';
        btnToggleCrop.style.display = '';
        btnToggleZoom.style.display = '';
        btnPipette.classList.remove('active');
        btnToggleZoom.classList.remove('active');
        magnifierEl.classList.remove('visible'); magnifierEl.style.display = 'none';
        applyZoomTransform();
    };

    // --- Color Picking ---
    document.querySelectorAll('.color-btn.preset').forEach(btn => {
        btn.onclick = () => {
            state.targetColor = {
                r: parseInt(btn.dataset.r),
                g: parseInt(btn.dataset.g),
                b: parseInt(btn.dataset.b)
            };
            updateColorUI();
            requestProcessing();
        };
    });

    btnPipette.onclick = () => setMode('pipette');
    btnToggleZoom.onclick = () => setMode('zoom');

    function updateColorUI() {
        const colorStr = `rgb(${state.targetColor.r}, ${state.targetColor.g}, ${state.targetColor.b})`;
        btnPipette.style.backgroundColor = colorStr;
        const isDark = (state.targetColor.r + state.targetColor.g + state.targetColor.b) < 400;

        const icon = btnPipette.querySelector('svg');
        if (icon) icon.style.color = isDark ? '#fff' : '#000';

        if (inputColorHex) {
            const hex = [state.targetColor.r, state.targetColor.g, state.targetColor.b]
                .map(v => v.toString(16).padStart(2, '0'))
                .join('')
                .toUpperCase();
            inputColorHex.value = hex;
        }

        document.querySelectorAll('.color-btn.preset').forEach(btn => {
            const active = parseInt(btn.dataset.r) === state.targetColor.r &&
                           parseInt(btn.dataset.g) === state.targetColor.g &&
                           parseInt(btn.dataset.b) === state.targetColor.b;
            btn.classList.toggle('active', active);
        });
    }

    // --- Crop Logic ---
    function enterCropMode() {
        btnToggleCrop.classList.add('active');
        cropConfirmActions.style.display = 'flex';
        cropSelection.style.display = 'block';

        const rect = mainCanvas.getBoundingClientRect();
        const contRect = previewContainer.getBoundingClientRect();
        state.cropRect = {
            x: rect.left - contRect.left + 20,
            y: rect.top - contRect.top + 20,
            w: rect.width - 40,
            h: rect.height - 40
        };
        updateCropUI();
    }

    function exitCropMode() {
        btnToggleCrop.classList.remove('active');
        cropConfirmActions.style.display = 'none';
        cropSelection.style.display = 'none';
        state.cropRect = null;
        state.activeHandle = null;
        state.dragStart = null;
    }

    btnToggleCrop.onclick = () => setMode('crop');

    btnCancelCrop.onclick = () => setMode(null);

    btnApplyCrop.onclick = () => {
        if (!state.cropRect || !state.image) return;

        const rect = mainCanvas.getBoundingClientRect();
        const contRect = previewContainer.getBoundingClientRect();
        const scaleX = mainCanvas.width / rect.width;
        const scaleY = mainCanvas.height / rect.height;

        const selX = (state.cropRect.x - (rect.left - contRect.left)) * scaleX;
        const selY = (state.cropRect.y - (rect.top - contRect.top)) * scaleY;
        const selW = state.cropRect.w * scaleX;
        const selH = state.cropRect.h * scaleY;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = selW; tempCanvas.height = selH;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        const drawCanvas = document.createElement('canvas');
        drawCanvas.width = state.image.width; drawCanvas.height = state.image.height;
        drawCanvas.getContext('2d', { willReadFrequently: true }).drawImage(state.image, 0, 0);
        tempCtx.drawImage(drawCanvas, selX, selY, selW, selH, 0, 0, selW, selH);

        const croppedImg = new Image();
        croppedImg.onload = () => {
            state.image = croppedImg;
            mainCanvas.width = croppedImg.width;
            mainCanvas.height = croppedImg.height;
            setMode(null);
            requestProcessing();
        };
        croppedImg.src = tempCanvas.toDataURL();
    };

    function updateCropUI() {
        if (!state.cropRect) return;
        cropSelection.style.left = state.cropRect.x + 'px';
        cropSelection.style.top = state.cropRect.y + 'px';
        cropSelection.style.width = state.cropRect.w + 'px';
        cropSelection.style.height = state.cropRect.h + 'px';

        const rect = mainCanvas.getBoundingClientRect();
        const scaleX = mainCanvas.width / rect.width;
        const scaleY = mainCanvas.height / rect.height;
        cropDimensions.innerText = `${Math.round(state.cropRect.w * scaleX)} x ${Math.round(state.cropRect.h * scaleY)} px`;
    }

    // --- Mouse Events ---
    previewContainer.onmousedown = (e) => {
        if (state.mode === 'crop') {
            const handle = e.target.dataset.handle;
            if (handle) {
                state.activeHandle = handle;
                const rect = previewContainer.getBoundingClientRect();
                state.dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            }
        } else if (state.mode === 'zoom') {
            state.dragStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
            mainCanvas.style.cursor = 'grabbing';
        }
    };

    window.addEventListener('mousemove', (e) => {
        if (state.mode === 'crop' && state.activeHandle && state.cropRect && state.dragStart) {
            const contRect = previewContainer.getBoundingClientRect();
            const x = e.clientX - contRect.left;
            const y = e.clientY - contRect.top;
            const dx = x - state.dragStart.x;
            const dy = y - state.dragStart.y;

            if (state.activeHandle === 'move') {
                state.cropRect.x += dx;
                state.cropRect.y += dy;
            } else {
                if (state.activeHandle.includes('t')) { state.cropRect.y += dy; state.cropRect.h -= dy; }
                if (state.activeHandle.includes('b')) { state.cropRect.h += dy; }
                if (state.activeHandle.includes('l')) { state.cropRect.x += dx; state.cropRect.w -= dx; }
                if (state.activeHandle.includes('r')) { state.cropRect.w += dx; }
            }
            state.dragStart = { x, y };
            updateCropUI();
        } else if (state.mode === 'zoom' && state.dragStart && state.zoomLevel > 1) {
            const dx = e.clientX - state.dragStart.x;
            const dy = e.clientY - state.dragStart.y;
            state.panX = state.dragStart.panX + dx / state.zoomLevel;
            state.panY = state.dragStart.panY + dy / state.zoomLevel;
            applyZoomTransform();
        } else if (state.mode === 'pipette' && state.image) {
            const canvasRect = mainCanvas.getBoundingClientRect();
            if (e.clientX >= canvasRect.left && e.clientX <= canvasRect.right &&
                e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom) {
                updateMagnifier(e.clientX, e.clientY);
            } else {
                magnifierEl.classList.remove('visible'); magnifierEl.style.display = 'none';
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (state.mode === 'zoom') updateCursor();
        state.activeHandle = null;
        state.dragStart = null;
    });

    previewContainer.onclick = (e) => {
        if (state.mode !== 'pipette' || !state.image) return;
        if (e.target !== mainCanvas) return;
        pickColorAt(e.clientX, e.clientY);
    };

    // --- Touch Events ---
    let lastTouchDistance = 0;
    let pinchCenterX = 0, pinchCenterY = 0;

    previewContainer.ontouchstart = (e) => {
        if (state.mode === 'crop') {
            if (e.touches.length === 1) {
                const handle = e.target.dataset.handle;
                if (handle) {
                    e.preventDefault();
                    state.activeHandle = handle;
                    const rect = previewContainer.getBoundingClientRect();
                    state.dragStart = {
                        x: e.touches[0].clientX - rect.left,
                        y: e.touches[0].clientY - rect.top
                    };
                }
            }
            return;
        }
        if (state.mode === 'zoom') {
            if (e.touches.length === 2) {
                const t1 = e.touches[0], t2 = e.touches[1];
                const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY;
                lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
                const rect = previewContainer.getBoundingClientRect();
                pinchCenterX = (t1.clientX + t2.clientX) / 2 - rect.left;
                pinchCenterY = (t1.clientY + t2.clientY) / 2 - rect.top;
                state.dragStart = null;
            } else if (e.touches.length === 1 && state.zoomLevel > 1) {
                const t = e.touches[0];
                state.dragStart = { x: t.clientX, y: t.clientY, panX: state.panX, panY: state.panY };
            }
        } else if (state.mode === 'pipette') {
            if (e.touches.length === 1 && state.image) {
                e.preventDefault();
                updateMagnifier(e.touches[0].clientX, e.touches[0].clientY, true);
            }
        }
    };

    previewContainer.ontouchmove = (e) => {
        if (state.mode === 'crop' && state.activeHandle && state.cropRect && state.dragStart) {
            e.preventDefault();
            const contRect = previewContainer.getBoundingClientRect();
            const x = e.touches[0].clientX - contRect.left;
            const y = e.touches[0].clientY - contRect.top;
            const dx = x - state.dragStart.x;
            const dy = y - state.dragStart.y;

            if (state.activeHandle === 'move') {
                state.cropRect.x += dx;
                state.cropRect.y += dy;
            } else {
                if (state.activeHandle.includes('t')) { state.cropRect.y += dy; state.cropRect.h -= dy; }
                if (state.activeHandle.includes('b')) { state.cropRect.h += dy; }
                if (state.activeHandle.includes('l')) { state.cropRect.x += dx; state.cropRect.w -= dx; }
                if (state.activeHandle.includes('r')) { state.cropRect.w += dx; }
            }
            state.dragStart = { x, y };
            updateCropUI();
            return;
        }
        if (state.mode === 'zoom') {
            if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0], t2 = e.touches[1];
                const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY;
                const newDist = Math.sqrt(dx * dx + dy * dy);
                if (lastTouchDistance > 0) {
                    const scale = newDist / lastTouchDistance;
                    state.zoomLevel = Math.max(1, Math.min(3, state.zoomLevel * scale));
                    applyZoomTransform(pinchCenterX, pinchCenterY);
                }
                lastTouchDistance = newDist;
            } else if (e.touches.length === 1 && state.dragStart) {
                e.preventDefault();
                if (state.zoomLevel > 1) {
                    const t = e.touches[0];
                    state.panX = state.dragStart.panX + (t.clientX - state.dragStart.x) / state.zoomLevel;
                    state.panY = state.dragStart.panY + (t.clientY - state.dragStart.y) / state.zoomLevel;
                    applyZoomTransform();
                }
            }
        } else if (state.mode === 'pipette') {
            if (e.touches.length === 1 && state.image) {
                e.preventDefault();
                updateMagnifier(e.touches[0].clientX, e.touches[0].clientY, true);
            }
        }
    };

    previewContainer.ontouchend = (e) => {
        if (state.mode === 'crop') {
            state.activeHandle = null;
            state.dragStart = null;
            return;
        }
        if (state.mode === 'pipette' && e.changedTouches.length === 1 && state.image) {
            const t = e.changedTouches[0];
            pickColorAt(t.clientX, t.clientY);
            magnifierEl.classList.remove('visible'); magnifierEl.style.display = 'none';
        }
        lastTouchDistance = 0;
        state.dragStart = null;
    };

    previewContainer.ontouchcancel = () => {
        lastTouchDistance = 0;
        state.dragStart = null;
        magnifierEl.classList.remove('visible'); magnifierEl.style.display = 'none';
    };

    // --- Zoom Transform ---
    function applyZoomTransform(centerX = 0, centerY = 0) {
        const scale = state.zoomLevel;
        mainCanvas.style.transform = scale > 1
            ? `translate(${state.panX}px, ${state.panY}px) scale(${scale})`
            : 'none';
        if (centerX || centerY) {
            mainCanvas.style.transformOrigin = `${centerX}px ${centerY}px`;
        }
        updateCursor();
    }
});
