// Define audio information and load
var audio = new Audio();
audio.src = '';
audio.loop = true;
audio.autoplay = true;
audio.crossOrigin = "anonymous";
var die = false;

// Define variables for analyser
var audioContext, analyser, source, fbc_array, data, len, total;

// Define Audio Analyser Helpers
function createAudioContext() {
    if (!audioContext) { audioContext = new (window.AudioContext || window.webkitAudioContext); }
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024; // change this to more or less triangles
    len = analyser.fftSize / 16;
    console.log(source);
    console.log(audioContext);
    console.log(audio);
    
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
}

// Define main variables for canvas start
var canvas, canvasCtx;

// Define Canvas helpers
function createCanvas() {
    canvas = document.getElementById('analyser');
    canvasCtx = canvas.getContext('2d');
}

function defineSizesCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Define math info for draw
var i,
    cx, cy,
    r = 400,
    beginAngle = 0,
    angle,
    twoPI = 2 * Math.PI,
    angleGap = twoPI / 3,
    
    color = 'rgba(109,205,93, 0.5)';
var die = false;
var loop;
// Create the animation
function frameLooper() {
    
    
    if (!die) {
    
    
    loop = window.requestAnimationFrame(frameLooper);
    fbc_array = new Uint8Array(analyser.frequencyBinCount);

    canvasCtx.save();
    analyser.getByteFrequencyData(fbc_array);
    data = fbc_array;
    angle = beginAngle;
    cx = canvas.width / 2;
    cy = canvas.height / 2;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.strokeStyle = color;
    canvasCtx.globalCompositeOperation = 'lighter';
    canvasCtx.lineWidth = 10;
    total = 0;
    for (i = 8; i < len; i += 2) {
        angle += 2;
        canvasCtx.beginPath();
        canvasCtx.moveTo(cx + data[i] * Math.sin(angle), cy + data[i] * Math.cos(angle));
        canvasCtx.lineTo(cx + data[i] * Math.sin(angle + angleGap), cy + data[i] * Math.cos(angle + angleGap));
        canvasCtx.lineTo(cx + data[i] * Math.sin(angle + angleGap * 2), cy + data[i] * Math.cos(angle + angleGap * 2));
        canvasCtx.closePath();
        canvasCtx.stroke();
        total += data[i];
    }
    beginAngle = (beginAngle + 0.000001 * total) % twoPI;
    canvasCtx.restore();
    }
}

// call the magic =D
function init() {
    createAudioContext();
    createCanvas();
    defineSizesCanvas();
    frameLooper();
}

window.addEventListener('load', init, false);
window.addEventListener('resize', defineSizesCanvas, false);
