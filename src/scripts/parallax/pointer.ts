import type { Group } from "three";

let targetX = 0;
let targetY = 0;
let smoothX = 0;
let smoothY = 0;

export function initPointer() {
	// Listen to mouse movement and normalize from -1 to 1 (0 at center)
	window.addEventListener("mousemove", (e) => {
		targetX = (e.clientX / window.innerWidth) * 2 - 1;
		targetY = -(e.clientY / window.innerHeight) * 2 + 1; // Y is inverted in screen space
	});
}

// Update loop called every frame to lerp values smoothly
// This manual lerp mimics simple spring/smooth motion without extra setup
export function updateParallax(rig: Group, delta: number) {
	// Damping factor: lower is slower/smoother
	const damping = 5.0 * delta;

	// Interpolate towards target
	smoothX += (targetX - smoothX) * damping;
	smoothY += (targetY - smoothY) * damping;

	// Apply minimal rotation multipliers (radians)
	rig.rotation.y = -smoothX * 0.03; // Pan left/right
	rig.rotation.x = -smoothY * 0.015; // Pan up/down slightly
}

export function resetParallax(rig?: Group) {
	targetX = 0;
	targetY = 0;
	smoothX = 0;
	smoothY = 0;

	if (rig) {
		rig.rotation.y = 0;
		rig.rotation.x = 0;
	}
}
