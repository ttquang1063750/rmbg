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
        pickMode: false,
        originalFileName: 'removed-background',
        isCropMode: false,
        cropRect: null,
        activeHandle: null,
        dragStart: null
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
    const valTolerance = document.getElementById('val-tolerance');
    const valFeather = document.getElementById('val-feather');
    const valShrink = document.getElementById('val-shrink');
    const selectFormat = document.getElementById('select-format');
    const btnDownload = document.getElementById('btn-download');
    const txtDownload = document.getElementById('txt-download');
    const btnReset = document.getElementById('btn-reset');
    const btnToggleCrop = document.getElementById('btn-toggle-crop');
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

    // --- Magnifier ---
    function updateMagnifier(canvasX, canvasY) {
        const magCtx = magCanvas.getContext('2d', { willReadFrequently: true });
        const rect = mainCanvas.getBoundingClientRect();
        const scaleX = mainCanvas.width / rect.width;
        const scaleY = mainCanvas.height / rect.height;

        const sx = canvasX * scaleX - 30;
        const sy = canvasY * scaleY - 30;
        
        magCtx.clearRect(0, 0, 180, 180);
        magCtx.drawImage(mainCanvas, sx, sy, 60, 60, 0, 0, 180, 180);
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
        state.isCropMode = false;
        state.cropRect = null;
        uploadSection.style.display = 'flex';
        editorLayout.style.display = 'none';
        fileInput.value = '';
        cropSelection.style.display = 'none';
        btnToggleCrop.style.display = 'flex';
        cropConfirmActions.style.display = 'none';
    };

    // --- Color Picking ---
    previewContainer.onclick = (e) => {
        if (state.isCropMode || !state.pickMode) return;
        if (e.target !== mainCanvas) return;
        
        const rect = mainCanvas.getBoundingClientRect();
        const scaleX = mainCanvas.width / rect.width;
        const scaleY = mainCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = state.image.width;
        tempCanvas.height = state.image.height;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(state.image, 0, 0);
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        state.targetColor = { r: pixel[0], g: pixel[1], b: pixel[2] };
        updateColorUI();
        requestProcessing();
    };

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

    btnPipette.onclick = () => {
        state.pickMode = !state.pickMode;
        btnPipette.classList.toggle('active', state.pickMode);
        mainCanvas.style.cursor = state.pickMode ? 'crosshair' : 'default';
    };

    function updateColorUI() {
        const colorStr = `rgb(${state.targetColor.r}, ${state.targetColor.g}, ${state.targetColor.b})`;
        btnPipette.style.backgroundColor = colorStr;
        const isDark = (state.targetColor.r + state.targetColor.g + state.targetColor.b) < 400;
        
        const icon = btnPipette.querySelector('svg');
        if (icon) icon.style.color = isDark ? '#fff' : '#000';
        
        document.querySelectorAll('.color-btn.preset').forEach(btn => {
            const active = parseInt(btn.dataset.r) === state.targetColor.r && 
                           parseInt(btn.dataset.g) === state.targetColor.g && 
                           parseInt(btn.dataset.b) === state.targetColor.b;
            btn.classList.toggle('active', active);
        });
    }

    // --- Crop Logic ---
    btnToggleCrop.onclick = () => {
        state.isCropMode = true;
        btnToggleCrop.style.display = 'none';
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
    };

    btnCancelCrop.onclick = () => {
        state.isCropMode = false;
        btnToggleCrop.style.display = 'flex';
        cropConfirmActions.style.display = 'none';
        cropSelection.style.display = 'none';
    };

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
            state.isCropMode = false;
            state.cropRect = null;
            cropSelection.style.display = 'none';
            btnToggleCrop.style.display = 'flex';
            cropConfirmActions.style.display = 'none';

            // Ensure canvas dimensions match the new image
            mainCanvas.width = croppedImg.width;
            mainCanvas.height = croppedImg.height;

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

    // Mouse Events for Crop and Magnifier
    previewContainer.onmousedown = (e) => {
        if (!state.isCropMode) return;
        const handle = e.target.dataset.handle;
        if (handle) {
            state.activeHandle = handle;
            const rect = previewContainer.getBoundingClientRect();
            state.dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }
    };

    window.onmousemove = (e) => {
        const contRect = previewContainer.getBoundingClientRect();
        const x = e.clientX - contRect.left;
        const y = e.clientY - contRect.top;

        // Handle Crop Resize/Move
        if (state.activeHandle && state.cropRect && state.dragStart) {
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

        // Handle Magnifier (luôn hiện để quan sát ảnh khi rê chuột)
        const canvasRect = mainCanvas.getBoundingClientRect();
        if (!state.isCropMode && state.image &&
            e.clientX >= canvasRect.left && e.clientX <= canvasRect.right &&
            e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom) {
            
            magnifierEl.style.display = 'block';
            magnifierEl.style.left = (x - 90) + 'px';
            magnifierEl.style.top = (y - 90) + 'px';
            updateMagnifier(e.clientX - canvasRect.left, e.clientY - canvasRect.top);
        } else {
            magnifierEl.style.display = 'none';
        }
    };

    window.onmouseup = () => {
        state.activeHandle = null;
        state.dragStart = null;
    };
});
