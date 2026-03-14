import * as THREE from "three";

const canvas = document.querySelector("#hero-canvas") as HTMLCanvasElement;

if (canvas) {
	// Scene setup
	const scene = new THREE.Scene();

	// Camera setup
	const camera = new THREE.PerspectiveCamera(
		75,
		window.innerWidth / window.innerHeight,
		0.1,
		1000,
	);
	camera.position.z = 5;

	// Renderer setup
	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

	// Add primitive geometry
	const geometry = new THREE.IcosahedronGeometry(1.5, 1);
	const material = new THREE.MeshNormalMaterial({ wireframe: true });
	const mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	// Animation loop
	const animate = () => {
		requestAnimationFrame(animate);

		// Simple rotation
		mesh.rotation.x += 0.005;
		mesh.rotation.y += 0.01;

		renderer.render(scene, camera);
	};

	animate();

	// Resize handler
	window.addEventListener("resize", () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});
}
