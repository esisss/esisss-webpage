import * as THREE from "three";

export interface MedievalWindowOptions {
	width?: number;
	height?: number;
	depth?: number;
	emissiveColor?: number;
	emissiveIntensity?: number;
	color?: number;
	lightIntensity?: number;
	lightDistance?: number;
	glowOpacity?: number;
	glowScale?: number;
}

export interface MedievalWindowSetOptions extends MedievalWindowOptions {
	count?: number;
	spacing?: number;
}

function createGlowTexture(size = 256) {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d");

	if (!context) {
		const fallback = new THREE.Texture();
		fallback.needsUpdate = true;
		return fallback;
	}

	const gradient = context.createRadialGradient(
		size * 0.5,
		size * 0.5,
		0,
		size * 0.5,
		size * 0.5,
		size * 0.5,
	);
	gradient.addColorStop(0.0, "rgba(255, 250, 220, 1)");
	gradient.addColorStop(0.2, "rgba(255, 239, 185, 0.75)");
	gradient.addColorStop(0.55, "rgba(255, 226, 150, 0.24)");
	gradient.addColorStop(1.0, "rgba(255, 205, 120, 0)");

	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createMedievalWindow(
	options: MedievalWindowOptions = {},
): THREE.Group {
	const {
		width = 2,
		height = 5,
		depth = 0.2,
		emissiveColor = 0xffe8a8,
		emissiveIntensity = 7.2,
		color = 0x8a3f16,
		lightIntensity,
		lightDistance,
		glowOpacity = 1.0,
		glowScale = 1.18,
	} = options;

	const rectHeight = height - width * 0.5;
	const archRadius = width * 0.5;
	const fullHeight = rectHeight + archRadius;
	const fullWidth = width;
	const resolvedLightIntensity = lightIntensity ?? fullHeight * 5.5;
	const resolvedLightDistance =
		lightDistance ?? Math.max(fullWidth, fullHeight) * 10.5;

	const material = new THREE.MeshStandardMaterial({
		color,
		emissive: new THREE.Color(emissiveColor),
		emissiveIntensity,
		roughness: 0.4,
		metalness: 0.02,
		toneMapped: false,
	});

	const windowGroup = new THREE.Group();

	// Lower rectangular body
	const body = new THREE.Mesh(
		new THREE.BoxGeometry(width, rectHeight, depth),
		material,
	);
	body.position.y = rectHeight * 0.5;
	windowGroup.add(body);

	// Upper arch cap (half dome, primitive-based)
	const arch = new THREE.Mesh(
		new THREE.SphereGeometry(
			archRadius,
			20,
			14,
			0,
			Math.PI * 2,
			0,
			Math.PI * 0.5,
		),
		material,
	);
	arch.position.y = rectHeight;
	arch.scale.z = depth / width;
	windowGroup.add(arch);

	// Subtle warm local light from the window opening
	const windowLight = new THREE.PointLight(
		emissiveColor,
		resolvedLightIntensity,
		resolvedLightDistance,
		2,
	);
	windowLight.position.set(0, fullHeight * 0.52, depth * 1.8);
	windowGroup.add(windowLight);

	// Shape-matched glow shell (sticks to window silhouette)
	const glowMaterial = new THREE.MeshBasicMaterial({
		color: emissiveColor,
		transparent: true,
		opacity: glowOpacity,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: false,
		toneMapped: false,
	});

	const glowBody = new THREE.Mesh(
		new THREE.BoxGeometry(
			fullWidth * glowScale,
			rectHeight * glowScale,
			depth * 0.6,
		),
		glowMaterial,
	);
	glowBody.position.y = rectHeight * 0.5;
	glowBody.position.z = depth * 2.1;
	windowGroup.add(glowBody);

	const glowArch = new THREE.Mesh(
		new THREE.SphereGeometry(
			archRadius * glowScale,
			20,
			14,
			0,
			Math.PI * 2,
			0,
			Math.PI * 0.5,
		),
		glowMaterial,
	);
	glowArch.position.y = rectHeight;
	glowArch.position.z = depth * 2.1;
	glowArch.scale.z = (depth / width) * 1.25;
	windowGroup.add(glowArch);

	const haloSprite = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: createGlowTexture(),
			color: emissiveColor,
			transparent: true,
			opacity: glowOpacity * 1,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: false,
			toneMapped: false,
		}),
	);
	haloSprite.scale.set(fullWidth * 2.2, fullHeight * 2.0, 1);
	haloSprite.position.set(0, fullHeight * 0.5, depth * 2.35);
	windowGroup.add(haloSprite);

	const haloOuterSprite = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: createGlowTexture(),
			color: emissiveColor,
			transparent: true,
			opacity: glowOpacity * 0.6,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: false,
			toneMapped: false,
		}),
	);
	haloOuterSprite.scale.set(fullWidth * 8.1, fullHeight * 4.8, 1);
	haloOuterSprite.position.set(0, fullHeight * 0.5, depth * 2.45);
	windowGroup.add(haloOuterSprite);

	windowGroup.traverse((child) => {
		if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
			child.renderOrder = 30;
		}
	});

	return windowGroup;
}

export function createMedievalWindowSet(
	options: MedievalWindowSetOptions = {},
): THREE.Group {
	const { count = 3, spacing = 3.6, ...windowOptions } = options;

	const set = new THREE.Group();
	const totalWidth = (count - 1) * spacing;

	for (let i = 0; i < count; i++) {
		const windowMesh = createMedievalWindow(windowOptions);
		windowMesh.position.x = i * spacing - totalWidth * 0.5;
		set.add(windowMesh);
	}

	return set;
}
