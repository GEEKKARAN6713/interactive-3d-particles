// --- 1. Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 2. Particle System ---
const particleCount = 8000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const targetPositions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

for(let i=0; i<particleCount*3; i++) {
    positions[i] = (Math.random() - 0.5) * 50;
    targetPositions[i] = positions[i];
    colors[i] = 1;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({ 
    size: 0.15, 
    vertexColors: true, 
    blending: THREE.AdditiveBlending, 
    depthWrite: false 
});
const particles = new THREE.Points(geometry, material);
scene.add(particles);

// --- 3. Shape Templates ---
function getSpherePoint() {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 10;
    return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.sin(phi) * Math.sin(theta), z: r * Math.cos(phi) };
}

function getHeartPoint() {
    const t = Math.random() * Math.PI * 2;
    // 3D Heart approximation
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    const z = (Math.random()-0.5) * 5; 
    const scale = 0.5;
    return { x: x*scale, y: y*scale, z: z };
}

function getSaturnPoint(idx, total) {
    const ratio = idx / total;
    if (ratio < 0.7) { // Planet
        return getSpherePoint();
    } else { // Ring
        const angle = Math.random() * Math.PI * 2;
        const r = 14 + Math.random() * 6;
        return { x: r * Math.cos(angle), y: (Math.random()-0.5), z: r * Math.sin(angle) };
    }
}

function getFlowerPoint() {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI;
    const k = 4; // Petals
    const r = 10 * Math.abs(Math.cos(k * u)) * Math.sin(v) + 2;
    return { 
        x: r * Math.sin(v) * Math.cos(u), 
        y: r * Math.sin(v) * Math.sin(u), 
        z: r * Math.cos(v) 
    };
}

const shapes = ['sphere', 'heart', 'saturn', 'flower'];
let currentShapeIdx = 0;

function updateTargets(shape) {
    for (let i = 0; i < particleCount; i++) {
        let p;
        if (shape === 'sphere') p = getSpherePoint();
        else if (shape === 'heart') p = getHeartPoint();
        else if (shape === 'saturn') p = getSaturnPoint(i, particleCount);
        else if (shape === 'flower') p = getFlowerPoint();
        
        targetPositions[i*3] = p.x;
        targetPositions[i*3+1] = p.y;
        targetPositions[i*3+2] = p.z;
    }
}
updateTargets(shapes[0]);

// --- 4. Logic & Interaction ---
let expansion = 1.0;
let pinchTriggered = false;

function animate() {
    requestAnimationFrame(animate);
    
    const pos = geometry.attributes.position.array;
    
    for(let i=0; i<particleCount*3; i++) {
        const target = targetPositions[i] * expansion;
        pos[i] += (target - pos[i]) * 0.05; // Lerp smoothing
    }
    
    particles.rotation.y += 0.002;
    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
}
animate();

// --- 5. MediaPipe Hands ---
const videoElement = document.getElementById('input_video');
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // 1. Expansion (based on X position of index finger)
        expansion = 0.5 + (1.0 - indexTip.x) * 2.5; 

        // 2. Color (based on Y position)
        const hue = 1.0 - indexTip.y;
        material.color.setHSL(hue, 1.0, 0.5);

        // 3. Pinch Detection
        const dx = indexTip.x - thumbTip.x;
        const dy = indexTip.y - thumbTip.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 0.05) {
            if (!pinchTriggered) {
                currentShapeIdx = (currentShapeIdx + 1) % shapes.length;
                updateTargets(shapes[currentShapeIdx]);
                pinchTriggered = true;
            }
        } else {
            pinchTriggered = false;
        }
    }
});

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640,
    height: 480
});
cameraUtils.start();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});