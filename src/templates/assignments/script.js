document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('videoPlayer');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const timelineCanvas = document.getElementById('timelineCanvas');
    const timelineCtx = timelineCanvas.getContext('2d');
    const drawModeBtn = document.getElementById('drawMode');
    const eraseCurrentFrameBtn = document.getElementById('eraseCurrentFrameBtn');
    const brushSize = document.getElementById('brushSize');
    const availableColors = ["#ff0000", "#f1ee12", "#52eb0f", "#ffffff"];
    
    let isDrawing = false, isDrawMode = false;
    let lastX = 0, lastY = 0;
    let currentStroke = [];
    let frameAnnotations = new Map();
    let undoStack = [], redoStack = [];
    let selectedColor = availableColors[0];

    function getCurrentFrame() {
        return Math.floor(videoPlayer.currentTime * 24);
    }

    function getFrameAnnotation(frame) {
        if (!frameAnnotations.has(frame)) {
            frameAnnotations.set(frame, []);
        }
        return frameAnnotations.get(frame);
    }

    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const currentFrame = getCurrentFrame();
        const annotation = getFrameAnnotation(currentFrame);

        console.log(`Redrawing Frame: ${currentFrame}, Strokes: ${annotation.length}`);

        annotation.forEach(stroke => {
            if (stroke.points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                for (let i = 1; i < stroke.points.length; i++) {
                    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                }
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        });
    }

    function markTimeline() {
        timelineCtx.clearRect(0, 0, timelineCanvas.width, timelineCanvas.height);
        const totalFrames = Math.floor(videoPlayer.duration * 24);
        frameAnnotations.forEach((_, frame) => {
            const position = (frame / totalFrames) * timelineCanvas.width;
            timelineCtx.fillStyle = '#ff0000';
            timelineCtx.fillRect(position, 0, 3, timelineCanvas.height);
        });
    }

    function saveStroke() {
        if (currentStroke.length > 1) {
            const currentFrame = getCurrentFrame();
            getFrameAnnotation(currentFrame).push({
                points: [...currentStroke],
                color: selectedColor,
                width: brushSize.value
            });

            console.log("Saved Stroke:", getFrameAnnotation(currentFrame));

            undoStack.push(JSON.stringify([...frameAnnotations]));
            redoStack = [];
            markTimeline();
            redrawCanvas();
        }
        currentStroke = [];
    }

    function undo() {
        if (undoStack.length > 0) {
            redoStack.push(JSON.stringify([...frameAnnotations]));
            frameAnnotations = new Map(JSON.parse(undoStack.pop()));
            redrawCanvas();
        }
    }

    function redo() {
        if (redoStack.length > 0) {
            undoStack.push(JSON.stringify([...frameAnnotations]));
            frameAnnotations = new Map(JSON.parse(redoStack.pop()));
            redrawCanvas();
        }
    }

    function toggleDrawMode() {
        isDrawMode = !isDrawMode;
        drawModeBtn.classList.toggle('active', isDrawMode);
    }

    eraseCurrentFrameBtn.addEventListener('click', () => {
        const currentFrame = getCurrentFrame();
        frameAnnotations.delete(currentFrame);
        console.log(`Frame ${currentFrame} cleared`);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        markTimeline();
        redrawCanvas();
    });

    canvas.addEventListener('mousedown', (e) => {
        if (isDrawMode) {
            isDrawing = true;
            currentStroke = [{ x: e.offsetX, y: e.offsetY }];
            [lastX, lastY] = [e.offsetX, e.offsetY];
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing && isDrawMode) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = selectedColor;
            ctx.lineWidth = brushSize.value;
            ctx.lineCap = 'round';
            ctx.stroke();
    
            currentStroke.push({ x, y });
            [lastX, lastY] = [x, y];
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isDrawing) {
            saveStroke();
            isDrawing = false;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'b') toggleDrawMode();
        else if (e.ctrlKey && e.key === 'z') undo();
        else if (e.ctrlKey && e.key === 'y') redo();
    });

    drawModeBtn.addEventListener('click', toggleDrawMode);
    videoPlayer.addEventListener('loadedmetadata', markTimeline);
    videoPlayer.addEventListener('timeupdate', redrawCanvas);
});
