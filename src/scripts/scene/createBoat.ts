import { animate, motionValue } from "motion";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three-stdlib";
import boatUrl from "../../assets/3D/boat.glb?url";
import lampUrl from "../../assets/3D/lamp.glb?url";

export interface BoatController {
	boatGroup: THREE.Group;
	fireLight: THREE.PointLight;
	update: () => void;
}

function createGlowTexture() {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;

	const context = canvas.getContext("2d");
	if (!context) {
		const fallback = new THREE.Texture();
		fallback.needsUpdate = true;
		return fallback;
	}

	const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
	gradient.addColorStop(0.0, "rgba(255, 247, 210, 1)");
	gradient.addColorStop(0.25, "rgba(255, 230, 165, 0.95)");
	gradient.addColorStop(0.58, "rgba(255, 198, 108, 0.5)");
	gradient.addColorStop(1.0, "rgba(255, 168, 80, 0)");

	context.fillStyle = gradient;
	context.fillRect(0, 0, 256, 256);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

async function loadLampModel(loader: GLTFLoader) {
	try {
		const gltf = await loader.loadAsync(lampUrl);
		const lampModel = gltf.scene;

		const maxSide = 5;
		const initialBounds = new THREE.Box3().setFromObject(lampModel);
		const initialSize = initialBounds.getSize(new THREE.Vector3());
		const largestSide =
			Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
		const scale = maxSide / largestSide;
		lampModel.scale.setScalar(scale);

		const centeredBounds = new THREE.Box3().setFromObject(lampModel);
		const center = centeredBounds.getCenter(new THREE.Vector3());
		lampModel.position.sub(center);

		// const groundedBounds = new THREE.Box3().setFromObject(lampModel);
		lampModel.position.y -= 0.5;
		lampModel.position.z += 3;
		return lampModel;
	} catch (error) {
		console.error("Failed to load lamp asset:", error);
		return null;
	}
}

export async function createBoat(): Promise<BoatController> {
	const loader = new GLTFLoader();
	loader.setMeshoptDecoder(MeshoptDecoder);

	const gltf = await loader.loadAsync(boatUrl);
	const boatModel = gltf.scene;

	const maxSide = 12;
	const initialBounds = new THREE.Box3().setFromObject(boatModel);
	const initialSize = initialBounds.getSize(new THREE.Vector3());
	const largestSide =
		Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
	const scale = maxSide / largestSide;
	boatModel.scale.setScalar(scale * 2.5);

	const centeredBounds = new THREE.Box3().setFromObject(boatModel);
	const center = centeredBounds.getCenter(new THREE.Vector3());
	boatModel.position.sub(center);

	const groundedBounds = new THREE.Box3().setFromObject(boatModel);
	boatModel.position.y -= groundedBounds.min.y;

	const boatGroup = new THREE.Group();
	boatGroup.position.set(-8, -10, 75);
	boatGroup.rotation.y = Math.PI * 0.25;
	boatGroup.add(boatModel);

	const lampAnchor = new THREE.Group();
	lampAnchor.position.set(0, 6.1, 0);
	boatGroup.add(lampAnchor);

	const lampModel = await loadLampModel(loader);
	if (lampModel) {
		lampAnchor.add(lampModel);
	}

	const fireLight = new THREE.PointLight(0xffd68a, 180, 70, 2);
	fireLight.position.set(0, -1.3, 3);

	lampAnchor.add(fireLight);

	const bulbMaterial = new THREE.MeshBasicMaterial({
		color: 0xffe7ae,
		transparent: true,
		opacity: 0.82,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: false,
		toneMapped: false,
		fog: false,
	});
	const bulbMesh = new THREE.Mesh(
		new THREE.CylinderGeometry(0.3, 0.3, 1, 14),
		bulbMaterial,
	);
	bulbMesh.position.copy(fireLight.position);
	bulbMesh.renderOrder = 90;
	lampAnchor.add(bulbMesh);

	const glowMaterial = new THREE.SpriteMaterial({
		map: createGlowTexture(),
		color: 0xffc15a,
		transparent: true,
		opacity: 0.75,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		toneMapped: false,
	});
	const glowSprite = new THREE.Sprite(glowMaterial);
	glowSprite.position.copy(fireLight.position);
	glowSprite.scale.set(4, 4, 1);
	glowSprite.renderOrder = 89;
	lampAnchor.add(glowSprite);

	const coreGlowMaterial = new THREE.SpriteMaterial({
		map: createGlowTexture(),
		color: 0xffffff,
		transparent: true,
		opacity: 0.6,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: false,
		toneMapped: false,
		fog: false,
	});
	const coreGlowSprite = new THREE.Sprite(coreGlowMaterial);
	coreGlowSprite.position.copy(fireLight.position);
	coreGlowSprite.scale.set(1.15, 1.15, 1);
	coreGlowSprite.renderOrder = 91;
	lampAnchor.add(coreGlowSprite);

	const basePosition = boatGroup.position.clone();
	const baseRotation = boatGroup.rotation.clone();

	const bobY = motionValue(0);
	const swayX = motionValue(0);
	const surgeZ = motionValue(0);
	const rollZ = motionValue(0);
	const pitchX = motionValue(0);
	const yawY = motionValue(0);
	const fireIntensityMV = motionValue(180);
	const fireColorMV = motionValue(0.5);
	const glowScaleMV = motionValue(2.2);
	const glowOpacityMV = motionValue(0.75);

	const fireCore = new THREE.Color(0xffd08a);
	const fireHot = new THREE.Color(0xffefbe);
	const fireTemp = new THREE.Color();

	// Calmer anchored motion tuned to match gentler lake conditions
	const waveMotionDurationScale = 0.7;

	animate(bobY, [-0.1, 0.22, -0.08, 0.18, -0.1], {
		duration: 4.8 * waveMotionDurationScale,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(swayX, [-0.06, 0.1, -0.12, 0.07, -0.06], {
		duration: 7.2 * waveMotionDurationScale,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(surgeZ, [0.04, -0.08, 0.12, -0.05, 0.04], {
		duration: 8.4 * waveMotionDurationScale,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(rollZ, [-0.035, 0.06, -0.045, 0.04, -0.035], {
		duration: 6.3 * waveMotionDurationScale,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(pitchX, [0.03, -0.045, 0.035, -0.03, 0.03], {
		duration: 6 * waveMotionDurationScale,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(yawY, [-0.008, 0.012, -0.015, 0.01, -0.008], {
		duration: 9.6 * waveMotionDurationScale,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(fireIntensityMV, [600, 660, 625, 670, 645, 675, 635, 660], {
		duration: 1.6,
		ease: "linear",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(fireColorMV, [0.15, 0.9, 0.35, 0.78, 0.22, 0.88], {
		duration: 1.8,
		ease: "linear",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(glowScaleMV, [8.0, 8.7, 8.2, 8.9, 8.1, 8.6], {
		duration: 5,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	animate(glowOpacityMV, [0.2, 0.25, 0.2], {
		duration: 5,
		ease: "easeInOut",
		repeat: Number.POSITIVE_INFINITY,
	});

	const update = () => {
		boatGroup.position.x = basePosition.x + swayX.get();
		boatGroup.position.z = basePosition.z + surgeZ.get();
		boatGroup.position.y = basePosition.y + bobY.get();
		boatGroup.rotation.x = baseRotation.x + pitchX.get();
		boatGroup.rotation.y = baseRotation.y + yawY.get();
		boatGroup.rotation.z = baseRotation.z + rollZ.get();

		const mix = fireColorMV.get();
		fireTemp.lerpColors(fireCore, fireHot, mix);

		fireLight.intensity = fireIntensityMV.get();
		fireLight.color.copy(fireTemp);
		bulbMaterial.color.copy(fireTemp);
		bulbMaterial.opacity = 0.7 + glowOpacityMV.get() * 0.2;

		glowMaterial.color.copy(fireTemp);
		glowMaterial.opacity = glowOpacityMV.get();
		const glowScale = glowScaleMV.get();
		glowSprite.scale.set(glowScale, glowScale, 1);

		coreGlowMaterial.color.copy(fireTemp);
		coreGlowMaterial.opacity = glowOpacityMV.get() * 0.72;
		const coreScale = glowScale * 0.54;
		coreGlowSprite.scale.set(coreScale, coreScale, 1);
	};

	return { boatGroup, fireLight, update };
}
