import { onMount, onCleanup, createSignal } from 'solid-js';
import * as THREE from 'three';
import { useLocation, useNavigate } from '@solidjs/router';
import { requestJson } from '~/lib/api';

export default function StoreScene() {
    let containerRef!: HTMLDivElement;
    const navigate = useNavigate();
    const location = useLocation();

    // First-Person Interactive State
    const [actionPrompt, setActionPrompt] = createSignal('');

    onMount(() => {
        // 1. Scene Setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#87ceeb'); // Bright daytime sky blue
        scene.fog = new THREE.FogExp2('#87ceeb', 0.018); // Light haze

        // 2. Camera Setup
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.7, 12); // Moved back further to see the counter and room

        // 3. Renderer Setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        containerRef.appendChild(renderer.domElement);

        // 4. Lighting (Warm Retro Video Store — Daytime)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambientLight);

        // Hemisphere light for natural sun/ground bounce
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556633, 1.0);
        scene.add(hemiLight);

        // Sunlight directional (coming from outside the storefront)
        const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
        sunLight.position.set(-5, 15, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.far = 40;
        sunLight.shadow.camera.left = -12;
        sunLight.shadow.camera.right = 12;
        sunLight.shadow.camera.top = 12;
        sunLight.shadow.camera.bottom = -12;
        sunLight.shadow.bias = -0.001;
        scene.add(sunLight);

        // Neon Sign placeholder light (warm pink glow near entrance)
        const neonLight = new THREE.PointLight(0xff0055, 0.6, 8);
        neonLight.position.set(-4, 3, 5);
        scene.add(neonLight);

        // Exterior Fill Lights (sunlit sidewalk visible through glass)
        const exteriorLightBot = new THREE.PointLight(0xfff8e0, 1.5, 30);
        exteriorLightBot.position.set(0, 4, 14); // In front of bottom glass
        scene.add(exteriorLightBot);

        const exteriorLightLeft = new THREE.PointLight(0xfff8e0, 1.5, 30);
        exteriorLightLeft.position.set(-15, 4, 0); // Left of left glass
        scene.add(exteriorLightLeft);

        // Fluorescent Ceiling Lights (compact store — lower ceiling)
        const createFluorescentLight = (x: number, z: number) => {
            const light = new THREE.PointLight(0xfffaed, 1.0, 12);
            light.position.set(x, 3.8, z);
            light.castShadow = true;
            light.shadow.bias = -0.001;
            scene.add(light);

            const housingGeo = new THREE.BoxGeometry(2.5, 0.12, 0.5);
            const housingMat = new THREE.MeshStandardMaterial({ color: '#dddddd', metalness: 0.5 });
            const housing = new THREE.Mesh(housingGeo, housingMat);
            housing.position.set(x, 3.95, z);
            scene.add(housing);

            const tubeGeo = new THREE.BoxGeometry(2.3, 0.06, 0.4);
            const tubeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            tube.position.set(x, 3.88, z);
            scene.add(tube);
        };

        // 2x2 grid for compact 10x12 room
        [-3, 3].forEach(x => {
            [-2, 3].forEach(z => {
                createFluorescentLight(x, z);
            });
        });

        // 5. Basic Geometry (The Room - Compact Corner Store)
        const roomWidth = 10;
        const roomLength = 12;
        const roomHeight = 4;

        // Texture Generators
        const createWoodFloorTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const context = canvas.getContext('2d');
            if (context) {
                context.fillStyle = '#4a2f1e'; // Wood base color
                context.fillRect(0, 0, 512, 512);

                // Draw planks
                for (let x = 0; x <= 512; x += 64) {
                    context.strokeStyle = '#22110a';
                    context.lineWidth = 3;
                    context.beginPath();
                    context.moveTo(x, 0);
                    context.lineTo(x, 512);
                    context.stroke();
                }
                for (let y = 0; y <= 512; y += 128) {
                    context.strokeStyle = '#22110a';
                    context.lineWidth = 3;
                    context.beginPath();
                    context.moveTo(0, y + (Math.random() * 64));
                    context.lineTo(512, y + (Math.random() * 64));
                    context.stroke();
                }

                // Add simple grain noise
                for (let i = 0; i < 4000; i++) {
                    context.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
                    context.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 20, 1);
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(roomWidth / 8, roomLength / 8);
            return tex;
        };

        const createWallTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            if (context) {
                context.fillStyle = '#e8e6e1'; // Off-white/cream paint
                context.fillRect(0, 0, 128, 128);
                // Add subtle noise for texture
                for (let i = 0; i < 2000; i++) {
                    context.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
                    context.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        }

        // Generic procedural noise for roughness/bump maps
        const createNoiseTexture = (intensity: number = 0.5, resolution: number = 128, baseColor: string = '#ffffff') => {
            const canvas = document.createElement('canvas');
            canvas.width = resolution;
            canvas.height = resolution;
            const context = canvas.getContext('2d');
            if (context) {
                context.fillStyle = baseColor;
                context.fillRect(0, 0, resolution, resolution);
                for (let i = 0; i < resolution * resolution * 0.5; i++) {
                    const val = Math.random() * 255 * intensity;
                    context.fillStyle = `rgba(${val},${val},${val},0.05)`;
                    context.fillRect(Math.random() * resolution, Math.random() * resolution, 1, 1);
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        const woodFloorTex = createWoodFloorTexture();
        const wallTex = createWallTexture();
        wallTex.repeat.set(roomWidth / 4, roomHeight / 4);

        const woodBumpTex = createNoiseTexture(0.8, 256, '#444444');
        const metalRoughnessTex = createNoiseTexture(0.4, 128, '#aaaaaa');
        const plasticBumpTex = createNoiseTexture(0.2, 128, '#888888');

        // Floor
        const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
        const floorMat = new THREE.MeshStandardMaterial({
            map: woodFloorTex,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Ceiling
        const ceilingGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
        const ceilingMat = new THREE.MeshStandardMaterial({
            color: '#f5f5f0', // Light drop ceiling tiles
            roughness: 0.9,
            flatShading: true
        });
        const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = roomHeight;
        scene.add(ceiling);

        // Walls
        const wallMat = new THREE.MeshStandardMaterial({
            color: '#ffffff',
            map: wallTex,
            roughness: 0.8,
            flatShading: true
        });

        const baseboardMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.6 });
        const frameMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.4, metalness: 0.8 });
        const glassMat = new THREE.MeshStandardMaterial({
            color: '#aaddff',
            transparent: true,
            opacity: 0.25,
            roughness: 0.05,
            metalness: 0.9,
            side: THREE.DoubleSide
        });

        // Top Wall (Solid)
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, roomHeight, 1), wallMat);
        backWall.position.set(0, roomHeight / 2, -roomLength / 2);
        backWall.receiveShadow = true;
        scene.add(backWall);

        const backBaseboard = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.4, 1.2), baseboardMat);
        backBaseboard.position.set(0, 0.2, -roomLength / 2);
        scene.add(backBaseboard);

        // Right Wall (Solid)
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, roomHeight, roomLength), wallMat);
        rightWall.position.set(roomWidth / 2, roomHeight / 2, 0);
        rightWall.receiveShadow = true;
        scene.add(rightWall);

        const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, roomLength), baseboardMat);
        rightBaseboard.position.set(roomWidth / 2, 0.2, 0);
        scene.add(rightBaseboard);

        // Left Wall (Storefront Glass Window)
        const frameLeftW_front = new THREE.Mesh(new THREE.BoxGeometry(0.5, roomHeight, 0.5), frameMat);
        frameLeftW_front.position.set(-roomWidth / 2 + 0.25, roomHeight / 2, roomLength / 2);
        scene.add(frameLeftW_front);

        const frameLeftW_back = new THREE.Mesh(new THREE.BoxGeometry(0.5, roomHeight, 0.5), frameMat);
        frameLeftW_back.position.set(-roomWidth / 2 + 0.25, roomHeight / 2, -roomLength / 2);
        scene.add(frameLeftW_back);

        const frameLeftW_top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, roomLength), frameMat);
        frameLeftW_top.position.set(-roomWidth / 2 + 0.25, roomHeight - 0.25, 0);
        scene.add(frameLeftW_top);

        const frameLeftW_bot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, roomLength), frameMat);
        frameLeftW_bot.position.set(-roomWidth / 2 + 0.25, 0.25, 0);
        scene.add(frameLeftW_bot);

        const storeGlassLeft = new THREE.Mesh(new THREE.PlaneGeometry(roomLength - 1, roomHeight - 1), glassMat);
        storeGlassLeft.position.set(-roomWidth / 2 + 0.25, roomHeight / 2, 0);
        storeGlassLeft.rotation.y = Math.PI / 2;
        scene.add(storeGlassLeft);

        // Bottom Wall (Storefront Glass Window + Door)
        const frameBotW_left = new THREE.Mesh(new THREE.BoxGeometry(0.5, roomHeight, 0.5), frameMat);
        frameBotW_left.position.set(-roomWidth / 2 + 0.25, roomHeight / 2, roomLength / 2 - 0.25);
        scene.add(frameBotW_left);

        const frameBotW_right = new THREE.Mesh(new THREE.BoxGeometry(0.5, roomHeight, 0.5), frameMat);
        frameBotW_right.position.set(roomWidth / 2 - 0.25, roomHeight / 2, roomLength / 2 - 0.25);
        scene.add(frameBotW_right);

        const frameBotW_top = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.5, 0.5), frameMat);
        frameBotW_top.position.set(0, roomHeight - 0.25, roomLength / 2 - 0.25);
        scene.add(frameBotW_top);

        const frameBotW_bot = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.5, 0.5), frameMat);
        frameBotW_bot.position.set(0, 0.25, roomLength / 2 - 0.25);
        scene.add(frameBotW_bot);

        // Left pane (X: -4.5 to -1) -> center is -2.75, width 3.5
        const glassBotL = new THREE.Mesh(new THREE.PlaneGeometry(3.5, roomHeight - 1), glassMat);
        glassBotL.position.set(-2.75, roomHeight / 2, roomLength / 2 - 0.25);
        scene.add(glassBotL);

        // Right pane (X: 1 to 4.5) -> center is 2.75, width 3.5
        const glassBotR = new THREE.Mesh(new THREE.PlaneGeometry(3.5, roomHeight - 1), glassMat);
        glassBotR.position.set(2.75, roomHeight / 2, roomLength / 2 - 0.25);
        scene.add(glassBotR);

        // Door frame struts
        const frameBotW_midL = new THREE.Mesh(new THREE.BoxGeometry(0.2, roomHeight, 0.2), frameMat);
        frameBotW_midL.position.set(-1, roomHeight / 2, roomLength / 2 - 0.25);
        scene.add(frameBotW_midL);

        const frameBotW_midR = new THREE.Mesh(new THREE.BoxGeometry(0.2, roomHeight, 0.2), frameMat);
        frameBotW_midR.position.set(1, roomHeight / 2, roomLength / 2 - 0.25);
        scene.add(frameBotW_midR);

        // Open door (swung outwards towards the street)
        const doorPane = new THREE.Mesh(new THREE.PlaneGeometry(2, roomHeight - 1), glassMat);
        const dfGroup = new THREE.Group();
        dfGroup.position.set(-1, roomHeight / 2, roomLength / 2 - 0.25);
        dfGroup.rotation.y = Math.PI * 0.4;
        doorPane.position.set(1, 0, 0); // Offset to swing from corner hinge
        dfGroup.add(doorPane);

        // Door handle
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.8 }));
        handle.position.set(1.8, 0, 0.05);
        dfGroup.add(handle);
        scene.add(dfGroup);

        // Exterior Street View (Sunny daylight)
        const streetGroup = new THREE.Group();
        scene.add(streetGroup);

        // Texture Generators for Exterior
        const createSidewalkTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#b0b0a8'; // Concrete base
                ctx.fillRect(0, 0, 512, 512);

                // Noise
                for (let i = 0; i < 8000; i++) {
                    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
                    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
                }

                // Grid lines (slabs)
                ctx.strokeStyle = '#8a8a80';
                ctx.lineWidth = 4;
                for (let x = 0; x <= 512; x += 128) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
                }
                for (let y = 0; y <= 512; y += 128) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
                }

                // Curb edge highlight
                ctx.fillStyle = '#999990';
                ctx.fillRect(0, 500, 512, 12);
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        const createRoadTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#2a2a2a'; // Asphalt
                ctx.fillRect(0, 0, 512, 512);

                // Noise
                for (let i = 0; i < 15000; i++) {
                    const c = Math.random() > 0.5 ? 255 : 0;
                    ctx.fillStyle = `rgba(${c},${c},${c},${Math.random() * 0.04})`;
                    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        const createBuildingBrickTexture = (colorStr: string) => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = colorStr; // Brick base
                ctx.fillRect(0, 0, 256, 256);

                ctx.strokeStyle = '#222';
                ctx.lineWidth = 2;
                for (let y = 0; y < 256; y += 16) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
                    const offset = (y / 16) % 2 === 0 ? 0 : 24;
                    for (let x = 0; x <= 256; x += 48) {
                        ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + 16); ctx.stroke();
                    }
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        const sidewalkTex = createSidewalkTexture();
        sidewalkTex.repeat.set(10, 1);

        const roadTex = createRoadTexture();
        roadTex.repeat.set(10, 4);

        const buildBrick1 = createBuildingBrickTexture('#8a4332');
        buildBrick1.repeat.set(4, 8);
        const buildBrick2 = createBuildingBrickTexture('#63534b');
        buildBrick2.repeat.set(4, 8);

        // 4-Way Sidewalk Intersections
        const sidewalkGeoH = new THREE.BoxGeometry(100, 0.2, 5);
        const sidewalkGeoV = new THREE.BoxGeometry(5, 0.2, 100);
        const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.95 });

        // Bottom Right (Our Store)
        const sw1 = new THREE.Mesh(sidewalkGeoH, sidewalkMat); sw1.position.set(37, 0.1, 8.5); sw1.receiveShadow = true; streetGroup.add(sw1);
        const sw2 = new THREE.Mesh(sidewalkGeoV, sidewalkMat); sw2.position.set(-5.5, 0.1, -29); sw2.receiveShadow = true; streetGroup.add(sw2);

        // Bottom Left
        const sw3 = new THREE.Mesh(sidewalkGeoH, sidewalkMat); sw3.position.set(-58, 0.1, 8.5); sw3.receiveShadow = true; streetGroup.add(sw3);
        const sw4 = new THREE.Mesh(sidewalkGeoV, sidewalkMat); sw4.position.set(-20.5, 0.1, -29); sw4.receiveShadow = true; streetGroup.add(sw4);

        // Top Left
        const sw5 = new THREE.Mesh(sidewalkGeoH, sidewalkMat); sw5.position.set(-58, 0.1, 23.5); sw5.receiveShadow = true; streetGroup.add(sw5);
        const sw6 = new THREE.Mesh(sidewalkGeoV, sidewalkMat); sw6.position.set(-20.5, 0.1, 61); sw6.receiveShadow = true; streetGroup.add(sw6);

        // Top Right
        const sw7 = new THREE.Mesh(sidewalkGeoH, sidewalkMat); sw7.position.set(32, 0.1, 23.5); sw7.receiveShadow = true; streetGroup.add(sw7);
        const sw8 = new THREE.Mesh(sidewalkGeoV, sidewalkMat); sw8.position.set(-5.5, 0.1, 61); sw8.receiveShadow = true; streetGroup.add(sw8);

        // Roads (Cross)
        const roadGeoH = new THREE.BoxGeometry(160, 0.1, 10);
        const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.8 });
        const roadH = new THREE.Mesh(roadGeoH, roadMat);
        roadH.position.set(-13, 0.05, 16);
        roadH.receiveShadow = true;
        streetGroup.add(roadH);

        const roadGeoV = new THREE.BoxGeometry(10, 0.1, 160);
        const roadV = new THREE.Mesh(roadGeoV, roadMat);
        roadV.position.set(-13, 0.05, 16);
        roadV.receiveShadow = true;
        streetGroup.add(roadV);

        // Playable Area Boundary Walls - Snug fit across road gaps
        const boundaryWallMat = new THREE.MeshStandardMaterial({ map: buildBrick1, roughness: 0.9 });

        // Right side road block (between top-right and bottom-right buildings)
        const boundaryWallSide = new THREE.BoxGeometry(2, 6, 12);
        const wallRight = new THREE.Mesh(boundaryWallSide, boundaryWallMat);
        wallRight.position.set(13, 3, 16);
        streetGroup.add(wallRight);

        // Left side road block
        const wallLeft = new THREE.Mesh(boundaryWallSide, boundaryWallMat);
        wallLeft.position.set(-39, 3, 16);
        streetGroup.add(wallLeft);

        // Top and Bottom road blocks
        const boundaryWallVert = new THREE.BoxGeometry(12, 6, 2);
        const wallUp = new THREE.Mesh(boundaryWallVert, boundaryWallMat);
        wallUp.position.set(-13, 3, 38);
        streetGroup.add(wallUp);

        const wallDown = new THREE.Mesh(boundaryWallVert, boundaryWallMat);
        wallDown.position.set(-13, 3, -22); // Pulled way back to prevent clipping store
        streetGroup.add(wallDown);

        // Road Lines (Dashed Yellow & White Parking)
        const lineMatYellow = new THREE.MeshBasicMaterial({ color: '#d4ac0d' });
        const lineMatWhite = new THREE.MeshBasicMaterial({ color: '#dddddd' });

        // Horizontal Road Middle Dashed Line
        for (let ix = -90; ix < 60; ix += 3.5) {
            if (ix > -18 && ix < -8) continue; // Skip intersection center
            const line = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.15), lineMatYellow);
            line.rotation.x = -Math.PI / 2;
            line.position.set(ix, 0.11, 16);
            streetGroup.add(line);
        }

        // Vertical Road Middle Dashed Line
        for (let iz = -60; iz < 90; iz += 3.5) {
            if (iz > 11 && iz < 21) continue; // Skip intersection center
            const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2), lineMatYellow);
            line.rotation.x = -Math.PI / 2;
            line.position.set(-13, 0.11, iz);
            streetGroup.add(line);
        }

        // Horizontal Parking Lines (White)
        for (let ix = -90; ix < 60; ix += 6) {
            if (ix > -18 && ix < -8) continue;
            const pLineTop = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2), lineMatWhite);
            pLineTop.rotation.x = -Math.PI / 2;
            pLineTop.position.set(ix, 0.11, 12.5);
            streetGroup.add(pLineTop);

            const pLineBot = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2), lineMatWhite);
            pLineBot.rotation.x = -Math.PI / 2;
            pLineBot.position.set(ix, 0.11, 19.5);
            streetGroup.add(pLineBot);
        }

        // Vertical Parking Lines (White)
        for (let iz = -60; iz < 90; iz += 6) {
            if (iz > 11 && iz < 21) continue;
            const pLineL = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.15), lineMatWhite);
            pLineL.rotation.x = -Math.PI / 2;
            pLineL.position.set(-16.5, 0.11, iz);
            streetGroup.add(pLineL);

            const pLineR = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.15), lineMatWhite);
            pLineR.rotation.x = -Math.PI / 2;
            pLineR.position.set(-9.5, 0.11, iz);
            streetGroup.add(pLineR);
        }

        // Buildings (Generic Bronx-style)
        const createBuilding = (x: number, z: number, w: number, d: number, h: number, tex: THREE.CanvasTexture, rotationY: number, hasStorefront: boolean = false) => {
            const bldgGroup = new THREE.Group();
            bldgGroup.position.set(x, h / 2, z);
            bldgGroup.rotation.y = rotationY;

            // Main block
            const bldgMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
            const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMat);
            block.castShadow = true;
            block.receiveShadow = true;
            bldgGroup.add(block);

            if (hasStorefront) {
                // Large glowing pane at the bottom
                const storeWinGeo = new THREE.PlaneGeometry(w - 2, 3);
                const storeWinMat = new THREE.MeshStandardMaterial({ color: '#fffbdf', emissive: '#fffbdf', emissiveIntensity: 0.3 });
                const storeWin = new THREE.Mesh(storeWinGeo, storeWinMat);
                storeWin.position.set(0, 1.5 - h / 2, d / 2 + 0.01);
                bldgGroup.add(storeWin);

                const doorGeo = new THREE.PlaneGeometry(1.4, 2.2);
                const doorMat = new THREE.MeshStandardMaterial({ color: '#332211', roughness: 0.7 });
                const door = new THREE.Mesh(doorGeo, doorMat);
                door.position.set(w / 2 - 2, 1.1 - h / 2, d / 2 + 0.02);
                bldgGroup.add(door);
            } else {
                // Door
                const doorGeo = new THREE.PlaneGeometry(1.4, 2.2);
                const doorMat = new THREE.MeshStandardMaterial({ color: '#332211', roughness: 0.7 });
                const door = new THREE.Mesh(doorGeo, doorMat);
                door.position.set(0, 1.1 - h / 2, d / 2 + 0.01);
                bldgGroup.add(door);
            }

            // Windows & Balconies
            const winMat = new THREE.MeshStandardMaterial({ color: '#111122', metalness: 0.8, roughness: 0.2 });
            const frameMat = new THREE.MeshStandardMaterial({ color: '#eee', roughness: 0.6 });
            let startWy = hasStorefront ? 5.5 : 2.5;

            // Generate simple balconies for taller buildings to break up flatter monolithic walls
            const hasBalconies = h >= 18;
            const balconyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.4 });
            const balconyGeo = new THREE.BoxGeometry(1.6, 0.6, 0.5);

            for (let wy = startWy; wy < h - 1; wy += 3) {
                for (let wx = -w / 2 + 1.5; wx <= w / 2 - 1.5; wx += 2.5) {
                    // Quick check if window is at the back of the building (clip it) to save geometry
                    const winGeo = new THREE.PlaneGeometry(1.2, 1.8);

                    // Front window
                    const winF = new THREE.Mesh(winGeo, winMat);
                    winF.position.set(wx, wy - h / 2, d / 2 + 0.01);
                    bldgGroup.add(winF);
                    const sillF = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.2), frameMat);
                    sillF.position.set(wx, wy - h / 2 - 0.9, d / 2 + 0.05);
                    bldgGroup.add(sillF);

                    if (hasBalconies && Math.random() > 0.3 && wy > 5) {
                        const balc = new THREE.Mesh(balconyGeo, balconyMat);
                        balc.position.set(wx, wy - h / 2 - 0.6, d / 2 + 0.25);
                        bldgGroup.add(balc);
                    }

                    // Back window
                    const winB = new THREE.Mesh(winGeo, winMat);
                    winB.rotation.y = Math.PI;
                    winB.position.set(wx, wy - h / 2, -d / 2 - 0.01);
                    bldgGroup.add(winB);
                    const sillB = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.2), frameMat);
                    sillB.position.set(wx, wy - h / 2 - 0.9, -d / 2 - 0.05);
                    bldgGroup.add(sillB);

                    if (hasBalconies && Math.random() > 0.3 && wy > 5) {
                        const balc = new THREE.Mesh(balconyGeo, balconyMat);
                        balc.position.set(wx, wy - h / 2 - 0.6, -d / 2 - 0.25);
                        bldgGroup.add(balc);
                    }
                }
            }
            streetGroup.add(bldgGroup);
        };

        // 3 Corner Stores
        createBuilding(-25, 4, 12, 10, 14, buildBrick1, -Math.PI / 2, true); // Bottom Left Corner
        createBuilding(-25, 28, 12, 10, 16, buildBrick2, Math.PI / 2, true); // Top Left Corner
        createBuilding(-1, 28, 12, 10, 12, buildBrick1, Math.PI, true); // Top Right Corner (fixed rotation)

        // Dense Urban Backdrop (Taller non-commercial buildings packing the blocks)

        // Block 1: Bottom Right (Behind our store)
        createBuilding(roomWidth / 2 + 6, roomLength / 2 + 1, 8, 8, 12, buildBrick1, 0, false);
        createBuilding(roomWidth / 2 + 14, roomLength / 2 + 1, 12, 8, 22, buildBrick2, 0, false);
        createBuilding(-1, -15, 14, 10, 26, buildBrick2, Math.PI, false); // Pushed back away from store
        createBuilding(13, -15, 14, 10, 18, buildBrick1, Math.PI, false);

        // Block 2: Bottom Left
        createBuilding(-25, -8, 12, 10, 24, buildBrick2, -Math.PI / 2, false);
        createBuilding(-25, -20, 12, 10, 32, buildBrick1, -Math.PI / 2, false);
        createBuilding(-39, 4, 12, 14, 38, buildBrick2, -Math.PI / 2, false);
        createBuilding(-39, -10, 12, 14, 20, buildBrick1, -Math.PI / 2, false);

        // Block 3: Top Left
        createBuilding(-25, 40, 12, 10, 28, buildBrick1, Math.PI / 2, false);
        createBuilding(-39, 28, 12, 14, 34, buildBrick2, Math.PI / 2, false);
        createBuilding(-39, 42, 12, 14, 45, buildBrick1, Math.PI / 2, false);

        // Block 4: Top Right
        createBuilding(13, 28, 14, 10, 20, buildBrick2, Math.PI, false);
        createBuilding(29, 28, 16, 10, 40, buildBrick1, Math.PI, false);
        createBuilding(-1, 40, 12, 12, 36, buildBrick2, Math.PI, false);
        createBuilding(13, 40, 14, 12, 28, buildBrick1, Math.PI, false);

        // Streetlamps
        const createLamp = (x: number, z: number) => {
            const lampGroup = new THREE.Group();
            lampGroup.position.set(x, 0.1, z);
            const lampPostGeo = new THREE.CylinderGeometry(0.08, 0.12, 5, 8);
            const lampPostMat = new THREE.MeshStandardMaterial({ color: '#222222', metalness: 0.8, roughness: 0.4 });
            const lampPost = new THREE.Mesh(lampPostGeo, lampPostMat);
            lampPost.position.y = 2.5;
            lampPost.castShadow = true;
            lampGroup.add(lampPost);
            const lampHeadGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5);
            const lampHead = new THREE.Mesh(lampHeadGeo, lampPostMat);
            lampHead.position.set(0.3, 5, 0);
            lampGroup.add(lampHead);
            streetGroup.add(lampGroup);
        };

        createLamp(roomWidth / 2, roomLength / 2 + 3.5);

        // Street Trees
        const createTree = (x: number, z: number) => {
            const treeGroup = new THREE.Group();
            treeGroup.position.set(x, 0, z);
            const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 5);
            const trunkMat = new THREE.MeshStandardMaterial({ color: '#3a2f2a', roughness: 0.9 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1; trunk.castShadow = true; treeGroup.add(trunk);
            const leavesGeo = new THREE.DodecahedronGeometry(1.5, 1);
            const leavesMat = new THREE.MeshStandardMaterial({ color: '#2d6a36', roughness: 0.8 });
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 2.5; leaves.castShadow = true; treeGroup.add(leaves);
            streetGroup.add(treeGroup);
        };
        createTree(4, 6.5);
        createTree(-17, -1);
        createTree(-17, 30);
        createTree(-30, 23.5);
        createTree(-30, 6.5);
        createTree(25, 23.5);
        createTree(25, 6.5);

        // Basic parked cars (Low poly proxies)
        const createParkedCar = (x: number, z: number, rotationY: number, color: string) => {
            const carGroup = new THREE.Group();
            carGroup.position.set(x, 0.4, z);
            carGroup.rotation.y = rotationY;
            const carMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.5), carMat);
            body.castShadow = true; body.receiveShadow = true; carGroup.add(body);
            const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 2.5), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.1 }));
            top.position.set(0, 0.7, -0.2); carGroup.add(top);
            streetGroup.add(carGroup);
        };
        createParkedCar(-16.2, 3, 0, '#421515'); // Red car parked on vert road
        createParkedCar(-9.8, 26, Math.PI, '#224455'); // Blue car on vert road
        createParkedCar(6, 12.8, Math.PI / 2, '#444444'); // Grey car on horiz road
        createLamp(-roomWidth / 2 - 4.5, roomLength / 2 + 3.5);
        createLamp(-roomWidth / 2 - 4.5, -roomLength / 2);

        // Parked Cars
        const createCar = (x: number, z: number, color: string, rotY: number) => {
            const carGroup = new THREE.Group();
            carGroup.position.set(x, 0.6, z);
            carGroup.rotation.y = rotY;
            const carBodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
            const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 2), carBodyMat);
            carBody.castShadow = true; carGroup.add(carBody);
            const carCabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.6), carBodyMat);
            carCabin.position.set(-0.3, 0.95, 0); carCabin.castShadow = true; carGroup.add(carCabin);

            // Windows
            const winMat = new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.9, roughness: 0.1 });
            const frontWin = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), winMat);
            frontWin.rotation.y = -Math.PI / 2; frontWin.position.set(-1.41, 0.95, 0); carGroup.add(frontWin);

            const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 });
            [[-1.3, 1.0], [1.3, 1.0], [-1.3, -1.0], [1.3, -1.0]].forEach(pos => {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.rotation.x = Math.PI / 2;
                wheel.position.set(pos[0], -0.3, pos[1]);
                carGroup.add(wheel);
            });
            streetGroup.add(carGroup);
        };

        createCar(2, roomLength / 2 + 7.5, '#2255aa', Math.PI); // Facing right
        createCar(-8, roomLength / 2 + 12.5, '#aa2233', 0); // Facing left across street
        createCar(-roomWidth / 2 - 7.5, 2, '#888888', Math.PI / 2); // Facing down left street


        // 6. Shelving & Aisles (Phase 3) Line the Top Wall
        const shelfGroup = new THREE.Group();
        scene.add(shelfGroup);

        const shelfWoodMat = new THREE.MeshStandardMaterial({ color: '#4a2f1d', roughness: 0.9, bumpMap: woodBumpTex, bumpScale: 0.03 }); // Darker classic wood

        // Helper to build a large wooden rental rack
        const buildRack = (x: number, y: number, z: number, rotationY: number = 0) => {
            const rack = new THREE.Group();
            const rackW = 2.6; // Smaller max width so left rack doesn't hit front window
            const rackH = 3.2;
            const rackD = 0.8;
            const hw = rackW / 2;

            // Side panels
            const sideGeo = new THREE.BoxGeometry(0.1, rackH, rackD);
            const sideL = new THREE.Mesh(sideGeo, shelfWoodMat); sideL.position.set(-hw, rackH / 2, 0); sideL.castShadow = true; rack.add(sideL);
            const sideR = new THREE.Mesh(sideGeo, shelfWoodMat); sideR.position.set(hw, rackH / 2, 0); sideR.castShadow = true; rack.add(sideR);

            // Top and Bottom
            const topBotGeo = new THREE.BoxGeometry(rackW + 0.1, 0.1, rackD);
            const top = new THREE.Mesh(topBotGeo, shelfWoodMat); top.position.set(0, rackH, 0); top.castShadow = true; rack.add(top);
            const bot = new THREE.Mesh(topBotGeo, shelfWoodMat); bot.position.set(0, 0.05, 0); bot.castShadow = true; rack.add(bot);

            // Back panel
            const backGeo = new THREE.BoxGeometry(rackW, rackH, 0.05);
            const back = new THREE.Mesh(backGeo, shelfWoodMat); back.position.set(0, rackH / 2, -rackD / 2 + 0.025); rack.add(back);

            // 3 main shelves
            for (let i = 0; i < 3; i++) {
                const yPos = 0.5 + (i * 0.95);
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.05, rackD - 0.05), shelfWoodMat);
                shelf.position.set(0, yPos, 0.025);
                // shelf.receiveShadow = true; // Optimization: Shelves don't need to receive shadows from every single box
                rack.add(shelf);
            }

            rack.position.set(x, y, z);
            rack.rotation.y = rotationY;
            shelfGroup.add(rack);
            return { rack, rackW };
        };

        // 3 large wooden racks against back wall
        buildRack(-2.9, 0, -5.5);
        buildRack(0, 0, -5.5);
        buildRack(2.9, 0, -5.5);

        // 6.5 Media Population (Filler + API Stock on Grid Layout)
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');

        const createProceduralCoverTexture = (hue: number) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128; // low res is fine
            canvas.height = 192;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Gradient base
                const grad = ctx.createLinearGradient(0, 0, 128, 192);
                grad.addColorStop(0, `hsl(${hue}, 60%, 40%)`);
                grad.addColorStop(1, `hsl(${hue + 40}, 60%, 15%)`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 128, 192);

                // Add some blocky text/shapes to simulate a poster
                ctx.fillStyle = `hsl(${hue + 180}, 50%, 80%)`;
                ctx.fillRect(10, 10, 108, 30); // Title bar

                ctx.fillStyle = '#111';
                ctx.fillRect(10, 50, 108, 80); // Main image block

                ctx.fillStyle = '#aaa';
                ctx.fillRect(10, 140, 108, 10); // Text lines
                ctx.fillRect(10, 160, 80, 10);

                // Add a bright sticker randomly
                if (Math.random() > 0.5) {
                    ctx.fillStyle = Math.random() > 0.5 ? '#ff2222' : '#ffee22';
                    ctx.beginPath();
                    ctx.arc(100, 150, 15, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        };

        const proceduralMats: THREE.MeshStandardMaterial[] = [];
        for (let i = 0; i < 20; i++) {
            proceduralMats.push(new THREE.MeshStandardMaterial({
                map: createProceduralCoverTexture(Math.random() * 360),
                roughness: 0.2, // glossy cover
                bumpMap: plasticBumpTex,
                bumpScale: 0.01
            }));
        }

        const createMediaGrid = (items: any[], rackX: number, rackZ: number, basePath: string, isMusic: boolean = false) => {
            const cols = isMusic ? 9 : 6; // slightly fewer cols to fit shorter rack
            const rows = 3;
            const totalSlots = cols * rows;

            // Dimensions for cases (smaller now to fit shelf)
            const cw = isMusic ? 0.22 : 0.35;
            const ch = isMusic ? 0.22 : 0.50;
            const cd = isMusic ? 0.04 : 0.06;

            const plasticMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4, bumpMap: plasticBumpTex, bumpScale: 0.01, metalness: 0.5 });

            const shelfWidth = 2.5; // Matches the rack interior
            const spacing = shelfWidth / cols;
            const startX = rackX - (shelfWidth / 2) + (spacing / 2);

            for (let i = 0; i < totalSlots; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);

                const x = startX + (col * spacing);
                const y = 0.5 + (row * 0.95) + ch / 2 + 0.025;
                const z = rackZ + 0.25;

                const caseGroup = new THREE.Group();
                const item = items[i];

                // Main Outer Plastic Case
                const outerGeo = new THREE.BoxGeometry(cw, ch, cd);
                const outerCase = new THREE.Mesh(outerGeo, plasticMat);
                // outerCase.castShadow = true; // Optimization: Disable cast shadow on 200+ grid items
                caseGroup.add(outerCase);

                // Inner Spine Ridge (to simulate high-poly clamshell)
                if (!isMusic) {
                    const ridgeGeo = new THREE.CylinderGeometry(cd / 2, cd / 2, ch, 8);
                    const ridge = new THREE.Mesh(ridgeGeo, plasticMat);
                    ridge.position.set(-cw / 2, 0, 0); // Left edge spine
                    caseGroup.add(ridge);
                }

                // Cover Art "Sleeve" or generic filler color
                let frontMat;
                if (item) {
                    const imgPath = isMusic ? item.posterPath || item.artworkPath : item.posterPath;
                    if (imgPath) {
                        const tex = textureLoader.load(imgPath + '?c=1');
                        frontMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.2 });
                    } else {
                        frontMat = proceduralMats[Math.floor(Math.random() * proceduralMats.length)];
                    }

                    // Interactive bounding box
                    const interactBox = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd * 2), new THREE.MeshBasicMaterial({ visible: false }));
                    interactBox.userData = { id: `media-${item.id}`, path: `${basePath}/${item.id}` };
                    caseGroup.add(interactBox);
                } else {
                    frontMat = proceduralMats[Math.floor(Math.random() * proceduralMats.length)];
                }

                const sleeveGeo = new THREE.PlaneGeometry(cw - 0.02, ch - 0.02);
                const cover = new THREE.Mesh(sleeveGeo, frontMat);
                cover.position.set(0, 0, cd / 2 + 0.001);
                caseGroup.add(cover);

                caseGroup.position.set(x, y, z);
                caseGroup.rotation.x = -0.15; // Lean back into the shelf

                shelfGroup.add(caseGroup);
            }
        };

        // Real Data Hooks
        requestJson<any[]>('/api/media/movies').then(res => {
            const data = Array.isArray(res) ? res : (res.data && Array.isArray(res.data) ? res.data : []);
            createMediaGrid(data, -2.9, -5.5, '/movies');
        });

        requestJson<any[]>('/api/media/tv').then(res => {
            const data = Array.isArray(res) ? res : (res.data && Array.isArray(res.data) ? res.data : []);
            createMediaGrid(data, 0, -5.5, '/tv');
        });

        // Fixed albums so it displays generic CDs accurately even if api is empty
        requestJson<any[]>('/api/media/music/albums').then(res => {
            const data = Array.isArray(res) ? res : (res.data && Array.isArray(res.data) ? res.data : []);
            createMediaGrid(data, 2.9, -5.5, '/music', true);
        }).catch(() => {
            // Fallback empty array if endpoint fails
            createMediaGrid([], 2.9, -5.5, '/music', true);
        });

        // 7. Checkout Counter (Right side, facing into room)
        const counterGroup = new THREE.Group();
        counterGroup.position.set(3.2, 0, -2);
        counterGroup.rotation.y = Math.PI; // Rotated 180° — front faces -z (into room)
        scene.add(counterGroup);

        // Main Desk — compact
        const deskMat = new THREE.MeshStandardMaterial({ color: '#4a2f1e', roughness: 0.95, bumpMap: woodBumpTex, bumpScale: 0.03 });
        const deskTopMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4, roughnessMap: plasticBumpTex, metalness: 0.2 });

        const deskBase = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.0, 1.4), deskMat);
        deskBase.position.set(0, 0.5, 0);
        deskBase.receiveShadow = true;
        counterGroup.add(deskBase);

        // Side panels for the desk to make it look built-in
        const deskSideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.6), deskMat);
        deskSideL.position.set(-1.75, 0.65, 0);
        counterGroup.add(deskSideL);
        const deskSideR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.6), deskMat);
        deskSideR.position.set(1.75, 0.65, 0);
        counterGroup.add(deskSideR);

        // Slatted Wood Front
        for (let i = 0; i < 18; i++) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.04), deskMat);
            slat.position.set(-1.6 + (i * 0.19), 0.5, 0.72);
            slat.castShadow = true;
            counterGroup.add(slat);
        }

        // Main Counter top
        const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 1.7), deskTopMat);
        deskTop.position.set(0, 1.04, 0);
        deskTop.castShadow = true;
        deskTop.receiveShadow = true;
        counterGroup.add(deskTop);

        // Raised customer ledge (facing the store)
        const customerLedge = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 0.4), deskTopMat);
        customerLedge.position.set(0, 1.3, 0.65);
        customerLedge.castShadow = true;
        counterGroup.add(customerLedge);

        // Supports for customer ledge
        const ledgeSupport1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: '#666', metalness: 0.8 }));
        ledgeSupport1.position.set(-1.2, 1.18, 0.65);
        counterGroup.add(ledgeSupport1);
        const ledgeSupport2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: '#666', metalness: 0.8 }));
        ledgeSupport2.position.set(1.2, 1.18, 0.65);
        counterGroup.add(ledgeSupport2);

        // CRT Monitor — Huge, no bottom clipping!
        const crtCaseMat = new THREE.MeshStandardMaterial({ color: '#dcd9d0', roughness: 0.6 });
        const crtScreenMat = new THREE.MeshBasicMaterial({ color: '#091c0e' });

        // Base/Main Box
        const crtBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.6), crtCaseMat);
        crtBase.position.set(0, 1.53, 0.1); // Shift forward
        crtBase.castShadow = true;
        counterGroup.add(crtBase);

        // Tapered back tube
        const crtBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), crtCaseMat);
        crtBack.position.set(0, 1.48, -0.45);
        counterGroup.add(crtBack);

        // Vent details on back
        const crtVent = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.52), new THREE.MeshStandardMaterial({ color: '#888' }));
        crtVent.position.set(0, 1.48, -0.45);
        counterGroup.add(crtVent);

        const crtBezel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.8, 0.08), crtCaseMat);
        crtBezel.position.set(0, 1.53, 0.41);
        counterGroup.add(crtBezel);

        const crtScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.7), crtScreenMat);
        crtScreen.position.set(0, 1.53, 0.46);
        crtScreen.userData = { id: 'register', path: '/search' };
        counterGroup.add(crtScreen);

        const screenLight = new THREE.PointLight(0x33ff33, 0.6, 3);
        screenLight.position.set(0, 1.5, 0.8);
        counterGroup.add(screenLight);

        // Keyboard & Mouse in front
        const kbGeo = new THREE.BoxGeometry(0.6, 0.04, 0.2);
        const kbMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', roughness: 0.8 });
        const keyboard = new THREE.Mesh(kbGeo, kbMat);
        keyboard.position.set(0, 1.10, 0.8);
        counterGroup.add(keyboard);

        const msGeo = new THREE.BoxGeometry(0.12, 0.05, 0.18);
        const mouse = new THREE.Mesh(msGeo, kbMat);
        mouse.position.set(0.4, 1.10, 0.8);
        mouse.rotation.y = -0.1;
        counterGroup.add(mouse);

        // Register drawer
        const registerBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: '#222' }));
        registerBody.position.set(-1.0, 1.15, 0.1);
        counterGroup.add(registerBody);

        // Return drop slot
        const dropBoxSlot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: '#111' }));
        dropBoxSlot.position.set(-1.0, 1.1, 0.4);
        counterGroup.add(dropBoxSlot);



        // 8. Atmosphere, Props & Polish (Phase 4)

        // Ficus Plant (near entrance)
        const plantGroup = new THREE.Group();
        plantGroup.position.set(-4, 0, 4.5);
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#cc5533', flatShading: true }));
        pot.position.y = 0.4;
        pot.castShadow = true;
        plantGroup.add(pot);

        const leavesMat = new THREE.MeshStandardMaterial({ color: '#228b22', flatShading: true });
        for (let i = 0; i < 3; i++) {
            const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), leavesMat);
            leaves.position.set((Math.random() - 0.5) * 0.5, 1.2 + (i * 0.4), (Math.random() - 0.5) * 0.5);
            leaves.castShadow = true;
            plantGroup.add(leaves);
        }
        scene.add(plantGroup);

        // Wall Clock
        const clockGroup = new THREE.Group();
        clockGroup.position.set(0, 3.2, -5.9);
        const clockBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 12), new THREE.MeshStandardMaterial({ color: '#111' }));
        clockBody.rotation.x = Math.PI / 2;
        clockGroup.add(clockBody);
        const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.22, 12), new THREE.MeshStandardMaterial({ color: '#fff' }));
        clockFace.rotation.x = Math.PI / 2;
        clockGroup.add(clockFace);
        scene.add(clockGroup);

        // Retro Poster (Right Wall)
        const posterGeo = new THREE.PlaneGeometry(1.8, 2.5);
        const posterMat = new THREE.MeshStandardMaterial({ color: '#ff0055' });
        const poster1 = new THREE.Mesh(posterGeo, posterMat);
        poster1.position.set(4.9, 2.5, -3);
        poster1.rotation.y = -Math.PI / 2;
        scene.add(poster1);

        const posterMat2 = new THREE.MeshStandardMaterial({ color: '#00ccff' });
        const poster2 = new THREE.Mesh(posterGeo, posterMat2);
        poster2.position.set(4.9, 2.5, 1);
        poster2.rotation.y = -Math.PI / 2;
        scene.add(poster2);

        // Counter props (rewinder, bell)
        const rewinder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: '#dd0000' }));
        rewinder.position.set(1.0, 1.15, -0.1);
        counterGroup.add(rewinder);

        const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8), new THREE.MeshStandardMaterial({ color: '#111' }));
        bellBase.position.set(-0.5, 1.15, 0);
        counterGroup.add(bellBase);
        const bellTop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8 }));
        bellTop.position.set(-0.5, 1.15, 0);
        counterGroup.add(bellTop);

        // Player Area (against right wall, facing into room)
        const tvGroup = new THREE.Group();
        tvGroup.position.set(4.2, 0, 2);
        tvGroup.rotation.y = -Math.PI / 2; // Screen faces -x (into room)
        scene.add(tvGroup);

        // Big Tube TV and Stand
        const tvStand = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: '#2a1a10' }));
        tvStand.position.set(0, 0.3, 0);
        tvGroup.add(tvStand);

        const vcr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: '#111' }));
        vcr.position.set(0, 0.65, 0);
        tvGroup.add(vcr);

        // Very Large Tube TV
        const displayTvGeo = new THREE.BoxGeometry(2.0, 1.6, 0.8); // thinner main box
        const displayTvMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 });
        const displayTv = new THREE.Mesh(displayTvGeo, displayTvMat);
        displayTv.position.set(0, 1.5, 0.1);
        tvGroup.add(displayTv);

        // Huge Tube Back
        const tvTubeBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.6), displayTvMat);
        tvTubeBack.position.set(0, 1.4, -0.6);
        tvGroup.add(tvTubeBack);

        // Venting block on back
        const tvVent = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.62), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.8 }));
        tvVent.position.set(0, 1.4, -0.6);
        tvGroup.add(tvVent);

        const tvBezel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 0.1), displayTvMat);
        tvBezel.position.set(0, 1.5, 0.48);
        tvGroup.add(tvBezel);

        const tvScreenGeo = new THREE.PlaneGeometry(1.8, 1.35);
        const tvScreenMat = new THREE.MeshBasicMaterial({ color: '#2244ff' });
        const tvScreen = new THREE.Mesh(tvScreenGeo, tvScreenMat);
        tvScreen.position.set(0, 1.5, 0.51);
        tvScreen.userData = { id: 'tv', path: '/player' };
        tvGroup.add(tvScreen);

        // Couch in front of TV
        const couchGroup = new THREE.Group();
        couchGroup.position.set(0, 0, 2.5); // Placed in front of TV
        const couchMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.9, flatShading: true });

        const cSeat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.0), couchMat);
        cSeat.position.set(0, 0.2, 0); cSeat.castShadow = true; cSeat.receiveShadow = true;
        couchGroup.add(cSeat);

        const cBack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.3), couchMat);
        cBack.position.set(0, 0.8, 0.35); cBack.castShadow = true;
        couchGroup.add(cBack);

        const cArmL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.1), couchMat);
        cArmL.position.set(-1.0, 0.5, 0.05); cArmL.castShadow = true;
        couchGroup.add(cArmL);

        const cArmR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.1), couchMat);
        cArmR.position.set(1.0, 0.5, 0.05); cArmR.castShadow = true;
        couchGroup.add(cArmR);

        tvGroup.add(couchGroup);

        // Compact speakers (adjusted to margins)
        const speakerGeo = new THREE.BoxGeometry(0.3, 0.8, 0.4);
        const speakerMat = new THREE.MeshStandardMaterial({ color: '#050505' });
        const spkLeft = new THREE.Mesh(speakerGeo, speakerMat);
        spkLeft.position.set(-1.4, 1.1, 0.1);
        tvGroup.add(spkLeft);
        const spkRight = new THREE.Mesh(speakerGeo, speakerMat);
        spkRight.position.set(1.4, 1.1, 0.1);
        tvGroup.add(spkRight);


        // 9. First-Person Controller & Interaction (Phase 8)
        const raycaster = new THREE.Raycaster();
        const centerScreen = new THREE.Vector2(0, 0); // Always raycast from center for crosshair interaction

        const keys = { w: false, a: false, s: false, d: false };
        let isDragging = false;
        let pMouseX = 0;
        let pMouseY = 0;
        let yaw = Math.PI / 4; // Look into the store
        let pitch = 0;

        camera.rotation.order = 'YXZ';
        camera.position.set(-3, 1.7, 4); // Start near entrance
        camera.rotation.y = yaw;

        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (keys.hasOwnProperty(key)) keys[key as keyof typeof keys] = true;

            // Interaction key
            if (key === 'e') {
                raycaster.setFromCamera(centerScreen, camera);
                const intersects = raycaster.intersectObjects(scene.children);
                if (intersects.length > 0) {
                    const obj = intersects[0].object as any;
                    if (obj.userData && obj.userData.path && intersects[0].distance < 4.0) {
                        void navigate(obj.userData.path);
                    }
                }
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (keys.hasOwnProperty(key)) keys[key as keyof typeof keys] = false;
        };

        const onPointerDown = (e: PointerEvent) => {
            if (!(e.target as HTMLElement).closest('canvas')) return; // Only drag when clicking the 3D canvas
            if (e.button === 0) { // Left Mouse Button
                isDragging = true;
                pMouseX = e.clientX;
                pMouseY = e.clientY;
                document.body.style.cursor = 'grabbing';
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            if (e.button === 0) {
                isDragging = false;
                document.body.style.cursor = 'default';
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            if (isDragging) {
                const deltaX = e.clientX - pMouseX;
                const deltaY = e.clientY - pMouseY;

                yaw -= deltaX * 0.003;
                pitch -= deltaY * 0.003;

                // Clamp pitch so we don't flip over
                pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));

                camera.rotation.y = yaw;
                camera.rotation.x = pitch;

                pMouseX = e.clientX;
                pMouseY = e.clientY;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointermove', onPointerMove);

        // 10. Resize Handler
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // 11. Animation Loop
        let animationFrameId: number;
        let arrivedRoute = '';
        const lastCamPos = new THREE.Vector3();
        const lastCamRot = new THREE.Euler();
        let lastCssMatrix = '';

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            // FPS Movement Logic
            const speed = 0.05; // Walk speed
            const velocity = new THREE.Vector3();

            if (keys.w) velocity.z -= speed;
            if (keys.s) velocity.z += speed;
            if (keys.a) velocity.x -= speed;
            if (keys.d) velocity.x += speed;

            // Apply camera rotation to movement vector
            velocity.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));

            // Tentative next position
            const nextX = camera.position.x + velocity.x;
            const nextZ = camera.position.z + velocity.z;

            // Store interior bounds
            let allowX = nextX > -4.5 && nextX < 4.5;
            let allowZ = nextZ > -5.5 && nextZ < 5.5; // Stops at Z=5.5 inside

            // Doorway opening (X between -0.8 and 0.8, Z between 5.5 and 6.5)
            if (nextX > -0.8 && nextX < 0.8 && nextZ >= 5.5 && nextZ <= 6.5) {
                allowX = true;
                allowZ = true;
            }

            // Playable Boundary: True Map Bounds for the Intersection
            // X goes from -40 to 14, Z goes from 2 to 30
            if (nextZ > 6.5 && nextZ < 30.0 && nextX > -40.0 && nextX < 14.0) {
                allowX = true;
                allowZ = true;
            }

            if (allowX) camera.position.x = nextX;
            if (allowZ) camera.position.z = nextZ;

            camera.position.y = 1.7; // Keep head fixed height

            // Simple raycast interact prompt logic
            raycaster.setFromCamera(centerScreen, camera);
            const intersects = raycaster.intersectObjects(scene.children);

            // Reset emissives for all meshes
            scene.children.forEach((child: any) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((m: any) => { if (m.emissive) m.emissive.setHex(0x000000); });
                    } else {
                        if (child.material.emissive) child.material.emissive.setHex(0x000000);
                    }
                }
            });

            let interactable = false;

            if (intersects.length > 0) {
                const obj = intersects[0].object as any;
                const dist = intersects[0].distance;
                if (obj.userData && obj.userData.path) {
                    // Only glowing/interactable if close enough (dist < 4)
                    if (dist < 4.0) {
                        interactable = true;
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach((m: any) => { if (m.emissive) m.emissive.setHex(0x333333); });
                        } else {
                            if (obj.material.emissive) obj.material.emissive.setHex(0x333333);
                        }
                    }
                }
            }

            // Update UI prompt signal
            if (interactable) {
                setActionPrompt(`Press [E] to interact`);
            } else {
                setActionPrompt('');
            }

            // Screen Projection - 4-corner homography for perspective-correct UI on 3D screens
            const path = location.pathname;
            const crtContainer = document.getElementById('crt-content-container');
            if (crtContainer && (path === '/' || path.startsWith('/search') || path.startsWith('/activity') || path.startsWith('/settings') || path.startsWith('/player'))) {
                let targetMesh = crtScreen;
                let meshW = 0.95, meshH = 0.7; // Updated CRT dimensions
                if (path.startsWith('/player')) {
                    targetMesh = tvScreen;
                    meshW = 1.8; meshH = 1.35; // Updated TV dimensions
                }

                targetMesh.updateMatrixWorld();
                camera.updateMatrixWorld(); // Fix CSS3D trailing lag by syncing matrix *before* projection

                const meshWorldPos = new THREE.Vector3().setFromMatrixPosition(targetMesh.matrixWorld);
                const distToMesh = camera.position.distanceTo(meshWorldPos);
                const projectedCenter = meshWorldPos.clone().project(camera);
                const isClose = distToMesh < 4.5 && projectedCenter.z < 1.0;

                if (document.fullscreenElement === crtContainer) {
                    crtContainer.style.position = 'absolute';
                    crtContainer.style.left = '0px';
                    crtContainer.style.top = '0px';
                    crtContainer.style.width = '100vw'; // Take up actual screen
                    crtContainer.style.height = '100vh';
                    crtContainer.style.transformOrigin = '0 0';
                    crtContainer.style.transform = 'none'; // Bypass projection
                    crtContainer.style.opacity = '1';
                    crtContainer.style.overflow = 'auto'; // allow scroll
                    lastCssMatrix = ''; // Reset cache
                } else if (isClose) {
                    const camMoved = !camera.position.equals(lastCamPos) || !camera.rotation.equals(lastCamRot);

                    if (camMoved || lastCssMatrix === '') {
                        const halfW = meshW / 2, halfH = meshH / 2;
                        const corners3D = [
                            new THREE.Vector3(-halfW, halfH, 0),
                            new THREE.Vector3(halfW, halfH, 0),
                            new THREE.Vector3(halfW, -halfH, 0),
                            new THREE.Vector3(-halfW, -halfH, 0),
                        ];
                        const ww = window.innerWidth, wh = window.innerHeight;
                        const corners2D = corners3D.map(c2 => {
                            const p = c2.clone().applyMatrix4(targetMesh.matrixWorld).project(camera);
                            return { x: (p.x + 1) * ww / 2, y: (-p.y + 1) * wh / 2 };
                        });
                        const srcW = 1024, srcH = 768; // Virtual resolution
                        const src = [{ x: 0, y: 0 }, { x: srcW, y: 0 }, { x: srcW, y: srcH }, { x: 0, y: srcH }];
                        const dst = corners2D;
                        const AA: number[][] = [];
                        const bb: number[] = [];
                        for (let i = 0; i < 4; i++) {
                            AA.push([src[i].x, src[i].y, 1, 0, 0, 0, -dst[i].x * src[i].x, -dst[i].x * src[i].y]);
                            bb.push(dst[i].x);
                            AA.push([0, 0, 0, src[i].x, src[i].y, 1, -dst[i].y * src[i].x, -dst[i].y * src[i].y]);
                            bb.push(dst[i].y);
                        }
                        const nn = 8;
                        const MM = AA.map((row, ri) => [...row, bb[ri]]);
                        let solvable = true;
                        for (let col = 0; col < nn; col++) {
                            let maxRow = col;
                            for (let row = col + 1; row < nn; row++) {
                                if (Math.abs(MM[row][col]) > Math.abs(MM[maxRow][col])) maxRow = row;
                            }
                            [MM[col], MM[maxRow]] = [MM[maxRow], MM[col]];
                            if (Math.abs(MM[col][col]) < 1e-10) { solvable = false; break; }
                            for (let row = col + 1; row < nn; row++) {
                                const f = MM[row][col] / MM[col][col];
                                for (let j = col; j <= nn; j++) MM[row][j] -= f * MM[col][j];
                            }
                        }
                        if (solvable) {
                            const hCoeffs = new Array(nn);
                            for (let i = nn - 1; i >= 0; i--) {
                                hCoeffs[i] = MM[i][nn];
                                for (let j = i + 1; j < nn; j++) hCoeffs[i] -= MM[i][j] * hCoeffs[j];
                                hCoeffs[i] /= MM[i][i];
                            }
                            lastCssMatrix = `matrix3d(${hCoeffs[0]},${hCoeffs[3]},0,${hCoeffs[6]},${hCoeffs[1]},${hCoeffs[4]},0,${hCoeffs[7]},0,0,1,0,${hCoeffs[2]},${hCoeffs[5]},0,1)`;
                            lastCamPos.copy(camera.position);
                            lastCamRot.copy(camera.rotation);
                        }
                    }

                    if (lastCssMatrix) {
                        crtContainer.style.position = 'absolute';
                        crtContainer.style.left = '0px';
                        crtContainer.style.top = '0px';
                        crtContainer.style.width = '1024px';
                        crtContainer.style.height = '768px';
                        crtContainer.style.transformOrigin = '0 0';
                        crtContainer.style.transform = lastCssMatrix;
                        crtContainer.style.opacity = '1';
                        crtContainer.style.overflow = 'auto'; // allow scroll
                    }

                    const innerMain = crtContainer.querySelector('main');
                    if (innerMain && arrivedRoute !== path) {
                        arrivedRoute = path;
                        innerMain.classList.remove('crt-boot');
                        void (innerMain as HTMLElement).offsetWidth;
                        innerMain.classList.add('crt-boot');
                    }
                } else {
                    crtContainer.style.opacity = '0';
                    if (arrivedRoute !== '') arrivedRoute = '';
                }

            } else if (crtContainer) {
                crtContainer.style.opacity = '0';
                arrivedRoute = '';
            }

            renderer.render(scene, camera);
        };

        animate();

        // 12. Cleanup
        onCleanup(() => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointermove', onPointerMove);
            if (containerRef && renderer.domElement) {
                containerRef.removeChild(renderer.domElement);
            }
            renderer.dispose();
            document.body.style.cursor = 'default';
        });
    });

    return (
        <>
            <div
                ref={containerRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    'z-index': -1, // Sits behind the 2D UI for now
                    overflow: 'hidden'
                }}
            />
            {actionPrompt() && (
                <div style={{
                    position: 'absolute',
                    bottom: '20vh',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.75)',
                    color: 'white',
                    padding: '8px 16px',
                    'border-radius': '4px',
                    'font-family': 'monospace',
                    'font-size': '1.2rem',
                    'pointer-events': 'none',
                    'z-index': 100,
                    border: '1px solid #777'
                }}>
                    {actionPrompt()}
                </div>
            )}

            {/* Center crosshair reticle */}
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                'pointer-events': 'none',
                'z-index': 100
            }}>
                {/* Horizontal bar */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '20px',
                    height: '2px',
                    'background-color': 'rgba(255, 255, 255, 0.6)',
                    transform: 'translate(-50%, -50%)',
                    'border-radius': '1px'
                }} />
                {/* Vertical bar */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '2px',
                    height: '20px',
                    'background-color': 'rgba(255, 255, 255, 0.6)',
                    transform: 'translate(-50%, -50%)',
                    'border-radius': '1px'
                }} />
                {/* Center dot */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '4px',
                    height: '4px',
                    'background-color': 'rgba(255, 255, 255, 0.9)',
                    'border-radius': '50%',
                    transform: 'translate(-50%, -50%)'
                }} />
            </div>
        </>
    );
}
