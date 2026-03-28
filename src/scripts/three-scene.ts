import * as THREE from "three";
import { OrbitControls } from "three-stdlib";
import { initPointer, resetParallax, updateParallax } from "./parallax/pointer";
import { setupComposer } from "./postprocessing/setupComposer";
import { createAtmosphere } from "./scene/createAtmosphere";
import { createBoat } from "./scene/createBoat";
import { createBoatPassenger } from "./scene/createBoatPassenger";
import { createCameraRig } from "./scene/createCameraRig";
import { createLake } from "./scene/createLake";
import { createLighting } from "./scene/createLighting";
import { createMountains } from "./scene/createMountains";
import { createOldCastle } from "./scene/createOldCastle";
import { createSky } from "./scene/createSky";

const canvas = document.querySelector("#hero-canvas") as HTMLCanvasElement;
const ENABLE_DEBUG_MODE = false;
const DEBUG_TOGGLE_ID = "debug-toggle";
const SCENE_LOADING_PROGRESS_EVENT = "scene-loading-progress";
const SCENE_LOADING_COMPLETE_EVENT = "scene-loading-complete";

function dispatchSceneLoadingProgress(progress: number) {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(SCENE_LOADING_PROGRESS_EVENT, {
			detail: {
				progress,
			},
		}),
	);
}

function dispatchSceneLoadingComplete() {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(new Event(SCENE_LOADING_COMPLETE_EVENT));
}

function setupDebugToggleButton(enabled: boolean): HTMLButtonElement | null {
	const existingButton = document.querySelector(
		`#${DEBUG_TOGGLE_ID}`,
	) as HTMLButtonElement | null;

	if (!enabled) {
		existingButton?.remove();
		return null;
	}

	if (existingButton) {
		existingButton.style.zIndex = "2147483647";
		return existingButton;
	}

	const button = document.createElement("button");
	button.id = DEBUG_TOGGLE_ID;
	button.type = "button";
	button.textContent = "Debug: On";
	button.style.position = "fixed";
	button.style.top = "1rem";
	button.style.right = "1rem";
	button.style.pointerEvents = "auto";
	button.style.zIndex = "2147483647";
	button.style.border = "1px solid rgba(255, 255, 255, 0.3)";
	button.style.borderRadius = "0.375rem";
	button.style.background = "rgba(0, 0, 0, 0.6)";
	button.style.padding = "0.375rem 0.75rem";
	button.style.color = "#ffffff";
	button.style.fontSize = "0.75rem";
	button.style.fontWeight = "600";
	button.style.letterSpacing = "0.06em";
	button.style.textTransform = "uppercase";
	button.style.cursor = "pointer";

	document.body.append(button);
	return button;
}

interface DebugModeController {
	isDebugMode: () => boolean;
	update: () => void;
	resize: (width: number, height: number) => void;
}

function createDebugModeController({
	enabled,
	scene,
	rig,
	camera,
	renderer,
	canvas,
	onModeChange,
}: {
	enabled: boolean;
	scene: THREE.Scene;
	rig: THREE.Group;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	canvas: HTMLCanvasElement;
	onModeChange: (isDebugMode: boolean) => void;
}): DebugModeController {
	if (!enabled) {
		setupDebugToggleButton(false);
		canvas.classList.remove("pointer-events-auto");
		canvas.classList.add("pointer-events-none");
		onModeChange(false);
		return {
			isDebugMode: () => false,
			update: () => {},
			resize: () => {},
		};
	}

	const debugToggleButton = setupDebugToggleButton(true);

	rig.updateWorldMatrix(true, false);
	camera.updateWorldMatrix(true, false);
	const originalCamPosition = new THREE.Vector3();
	const originalCamQuaternion = new THREE.Quaternion();
	camera.getWorldPosition(originalCamPosition);
	camera.getWorldQuaternion(originalCamQuaternion);

	const debugDummyCamera = new THREE.PerspectiveCamera(
		camera.fov,
		camera.aspect,
		camera.near,
		camera.far,
	);
	debugDummyCamera.position.copy(originalCamPosition);
	debugDummyCamera.quaternion.copy(originalCamQuaternion);
	scene.add(debugDummyCamera);

	const debugDummyHelper = new THREE.CameraHelper(debugDummyCamera);
	scene.add(debugDummyHelper);

	const debugDummyMarker = new THREE.Mesh(
		new THREE.SphereGeometry(0.6, 12, 12),
		new THREE.MeshBasicMaterial({ color: 0xffc857 }),
	);
	debugDummyMarker.position.copy(originalCamPosition);
	scene.add(debugDummyMarker);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.screenSpacePanning = true;
	controls.minDistance = 1;
	controls.maxDistance = 500;
	controls.maxPolarAngle = Math.PI;
	controls.target.set(0, 0, -60);
	controls.update();

	let isDebugMode = true;

	function applyDebugMode() {
		controls.enabled = isDebugMode;
		debugDummyCamera.visible = isDebugMode;
		debugDummyHelper.visible = isDebugMode;
		debugDummyMarker.visible = isDebugMode;

		canvas.classList.toggle("pointer-events-auto", isDebugMode);
		canvas.classList.toggle("pointer-events-none", !isDebugMode);

		if (debugToggleButton) {
			debugToggleButton.textContent = isDebugMode ? "Debug: On" : "Debug: Off";
		}

		onModeChange(isDebugMode);
	}

	if (debugToggleButton) {
		debugToggleButton.addEventListener("click", () => {
			isDebugMode = !isDebugMode;
			applyDebugMode();
		});
	}

	applyDebugMode();

	return {
		isDebugMode: () => isDebugMode,
		update: () => {
			if (isDebugMode) {
				controls.update();
			}
		},
		resize: (width: number, height: number) => {
			debugDummyCamera.aspect = width / height;
			debugDummyCamera.updateProjectionMatrix();
			debugDummyHelper.update();
		},
	};
}

if (canvas) {
	const loadingManager = new THREE.LoadingManager();

	loadingManager.onStart = () => {
		dispatchSceneLoadingProgress(0);
	};

	loadingManager.onProgress = (_url, loaded, total) => {
		if (total <= 0) {
			dispatchSceneLoadingProgress(0);
			return;
		}

		const progress = Math.min(Math.max(loaded / total, 0), 1);
		dispatchSceneLoadingProgress(progress * 100);
	};

	loadingManager.onLoad = () => {
		dispatchSceneLoadingProgress(100);
	};

	loadingManager.onError = () => {
		// Keep loading overlay active until all pending requests finish.
	};

	dispatchSceneLoadingProgress(0);

	// Initialize scene
	const scene = new THREE.Scene();

	// 1. Setup Camera Rig
	const { rig, camera } = createCameraRig(
		52,
		window.innerWidth / window.innerHeight,
	);
	scene.add(rig);

	// 2. Setup Renderer
	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
		powerPreference: "high-performance",
	});
	let debugModeController: DebugModeController;
	const resizeRenderer = () => {
		const bounds = canvas.getBoundingClientRect();
		const width = Math.max(Math.round(bounds.width), 1);
		const height = Math.max(Math.round(bounds.height), 1);

		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		debugModeController.resize(width, height);

		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height, false);
		composer.setSize(width, height);
	};

	// 3. Post-Processing Pipeline
	const { composer } = setupComposer(renderer, scene, camera);

	let pointerInitialized = false;

	function ensurePointerTracking() {
		if (pointerInitialized) return;
		initPointer();
		pointerInitialized = true;
	}

	debugModeController = createDebugModeController({
		enabled: ENABLE_DEBUG_MODE,
		scene,
		rig,
		camera,
		renderer,
		canvas,
		onModeChange: (isDebugMode) => {
			if (!isDebugMode) {
				ensurePointerTracking();
			}
		},
	});

	// 4. Build Static Layers First

	// Sky Layer
	const sky = createSky();
	scene.add(sky);

	// Atmosphere Layer (Global Fog + Mist Planes)
	const atmosphere = createAtmosphere(scene);
	const { mistGroup } = atmosphere;
	atmosphere.setMistRadius(0.5);
	atmosphere.setMistHeight(1); // Default mist height
	atmosphere.setMistDensity(5); // Default mist density
	// atmosphere.setMistY();
	atmosphere.setMistPosition(0, 0, 130); // Start mist slightly below camera height and in front
	atmosphere.setWarmLight(null); // Start with no warm light influence

	scene.add(mistGroup);

	// Lake Foreground (procedural water shader)
	const lake = createLake();
	scene.add(lake.lakeGroup);

	// Lighting
	const { lightingGroup } = createLighting();
	scene.add(lightingGroup);

	// 5. Pointer interaction is active when debug mode is off

	// 6. Clock for delta-based smooth animations
	const clock = new THREE.Clock();
	const maxFrameDelta = 1 / 30;
	let isDocumentVisible = !document.hidden;
	let boatController: Awaited<ReturnType<typeof createBoat>> | null = null;

	const handleVisibilityChange = () => {
		isDocumentVisible = !document.hidden;
		clock.getDelta();

		if (!isDocumentVisible) {
			resetParallax(rig);
		}
	};

	document.addEventListener("visibilitychange", handleVisibilityChange);

	// 7. Load async assets while rendering stays active
	async function init() {
		const mountainsPromise = createMountains(loadingManager);
		const oldCastlePromise = createOldCastle({
			position: { x: -20, y: 28, z: -210 },
			scale: 90,
			rotation: { x: 0, y: Math.PI * 0.2, z: 0 },
			loadingManager,
		});
		const boatPromise = createBoat(loadingManager);
		const passengerPromise = createBoatPassenger({
			position: { x: 2, y: 1, z: -10 },
			rotation: { x: 0, y: Math.PI * -0.2, z: 0 },
			targetHeight: 1.85,
			loadingManager,
		});

		const [mountainsResult, oldCastleResult, boatResult, passengerResult] =
			await Promise.allSettled([
				mountainsPromise,
				oldCastlePromise,
				boatPromise,
				passengerPromise,
			]);

		if (mountainsResult.status === "fulfilled") {
			scene.add(mountainsResult.value.farMountains);
			scene.add(mountainsResult.value.midMountains);
		} else {
			console.error("Failed to load mountain assets:", mountainsResult.reason);
		}

		if (oldCastleResult.status === "fulfilled") {
			scene.add(oldCastleResult.value);
		} else {
			console.error("Failed to load old castle asset:", oldCastleResult.reason);
		}

		if (boatResult.status === "fulfilled") {
			boatController = boatResult.value;
			scene.add(boatController.boatGroup);
			atmosphere.setWarmLight(boatController.fireLight);

			if (passengerResult.status === "fulfilled") {
				boatController.boatGroup.add(passengerResult.value);
			} else {
				console.error(
					"Failed to load boat passenger asset:",
					passengerResult.reason,
				);
			}
		} else {
			console.error("Failed to load boat asset:", boatResult.reason);
		}

		dispatchSceneLoadingProgress(100);
		dispatchSceneLoadingComplete();
	}

	// Animation Loop
	function animate() {
		requestAnimationFrame(animate);
		const rawDelta = clock.getDelta();
		const delta = Math.min(rawDelta, maxFrameDelta);

		if (!isDocumentVisible) {
			composer.render(0);
			return;
		}

		if (debugModeController.isDebugMode()) {
			debugModeController.update();
		} else {
			updateParallax(rig, delta);
		}

		if (typeof sky.userData.update === "function") {
			sky.userData.update(camera);
		}

		// Update lake water shader (time + camera position)
		lake.syncLightsFromScene(scene);
		lake.update(delta, camera);
		atmosphere.update(delta, camera);

		// Boat idle motion
		if (boatController) {
			boatController.update();
		}

		composer.render(delta);
	}

	resizeRenderer();
	window.addEventListener("resize", resizeRenderer);

	animate();

	// Start async asset loading
	init();
}
