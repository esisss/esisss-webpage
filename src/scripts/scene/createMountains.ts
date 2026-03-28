import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three-stdlib";

// Import mountain assets
import mountain1Url from "../../assets/3D/mountain1.glb?url";
import mountain2Url from "../../assets/3D/mountain2.glb?url";
import mountain3Url from "../../assets/3D/mountain3.glb?url";

export interface MountainLayers {
	farMountains: THREE.Group;
	midMountains: THREE.Group;
}

// Async function to load and create mountain layers
export async function createMountains(
	loadingManager?: THREE.LoadingManager,
): Promise<MountainLayers> {
	const loader = new GLTFLoader(loadingManager);
	loader.setMeshoptDecoder(MeshoptDecoder);
	const farMountains = new THREE.Group();
	const midMountains = new THREE.Group();

	// Helper to load a GLB file
	const loadModel = (url: string): Promise<THREE.Group> => {
		return new Promise((resolve, reject) => {
			loader.load(
				url,
				(gltf) => {
					resolve(gltf.scene);
				},
				undefined,
				reject,
			);
		});
	};

	// Load all mountain models
	const [mountain1, mountain2, mountain3] = await Promise.all([
		loadModel(mountain1Url),
		loadModel(mountain2Url),
		loadModel(mountain3Url),
	]);

	// Far Mountains Material (Desaturated, low contrast for distance)
	const farMaterial = new THREE.MeshStandardMaterial({
		color: 0x6b7a8a,
		roughness: 0.9,
	});

	// Mid Mountains Material (Darker, closer)
	const midMaterial = new THREE.MeshStandardMaterial({
		color: 0x4a5568,
		roughness: 0.8,
	});

	// Helper to clone a model, apply material, and configure it
	const createMountainInstance = (
		model: THREE.Group,
		material: THREE.Material,
		position: { x: number; y: number; z: number },
		scale: number,
		rotationY: number,
	): THREE.Group => {
		const clone = model.clone(true);

		// Apply material to all meshes in the model
		clone.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.material = material;
			}
		});

		clone.position.set(position.x, position.y, position.z);
		clone.scale.setScalar(scale);
		clone.rotation.y = rotationY;

		return clone;
	};

	// Far Mountain Layer (z: -120 to -150 range)
	// Using different models for variety
	// farMountains.add(
	//   createMountainInstance(
	//     mountain1,
	//     farMaterial,
	//     { x: -80, y: -15, z: -130 },
	//     1,
	//     Math.PI / 6,
	//   ),
	// );
	// farMountains.add(
	//   createMountainInstance(
	//     mountain2,
	//     farMaterial,
	//     { x: 0, y: -10, z: -150 },
	//     0.5,
	//     0.2,
	//   ),
	// );
	// farMountains.add(
	//   createMountainInstance(
	//     mountain3,
	//     farMaterial,
	//     { x: 70, y: -12, z: -140 },
	//     0.5,
	//     -Math.PI / 5,
	//   ),
	// );
	farMountains.add(
		createMountainInstance(
			mountain2,
			farMaterial,
			{ x: 0, y: -50, z: -1000 },
			12,
			-Math.PI / 2.5,
		),
	);

	// Mid Mountain Layer (z: -40 to -80 range)

	midMountains.add(
		createMountainInstance(
			mountain1,
			midMaterial,
			{ x: 170, y: -22, z: -150 },
			0.25,
			45,
		),
	);
	midMountains.add(
		createMountainInstance(
			mountain2,
			midMaterial,
			{ x: -200, y: -30, z: -200 },
			2.5,
			30,
		),
	);
	midMountains.add(
		createMountainInstance(
			mountain3,
			midMaterial,
			{ x: 0, y: -22, z: -190 },
			0.2,
			30,
		),
	);

	return { farMountains, midMountains };
}
