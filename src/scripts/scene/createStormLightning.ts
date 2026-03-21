import * as THREE from "three";

export interface StormLightningController {
	stormGroup: THREE.Group;
	update: (delta: number) => void;
}

function randomInRange(min: number, max: number) {
	return min + Math.random() * (max - min);
}

export function createStormLightning(): StormLightningController {
	const stormGroup = new THREE.Group();

	const lightningDir = new THREE.DirectionalLight(0xeaf2ff, 0);
	lightningDir.position.set(40, 180, -40);
	lightningDir.target.position.set(0, -10, -60);
	stormGroup.add(lightningDir);
	stormGroup.add(lightningDir.target);

	const lightningFill = new THREE.AmbientLight(0xdce8ff, 0);
	stormGroup.add(lightningFill);

	let timeToNextStrike = randomInRange(8, 15);
	let activeStrike = false;
	let pulseIndex = 0;
	let pulseElapsed = 0;
	let pulseDurations: number[] = [];
	let pulsePeaks: number[] = [];

	const startStrike = () => {
		activeStrike = true;
		pulseIndex = 0;
		pulseElapsed = 0;

		const pulseCount = Math.floor(randomInRange(3, 7));
		const isMegaStrike = Math.random() < 0.25;

		pulseDurations = Array.from({ length: pulseCount }, () =>
			randomInRange(0.05, 0.18),
		);
		pulsePeaks = Array.from({ length: pulseCount }, () =>
			isMegaStrike ? randomInRange(24, 46) : randomInRange(12, 26),
		);

		lightningDir.position.set(
			randomInRange(-130, 130),
			randomInRange(130, 220),
			randomInRange(-220, 20),
		);
	};

	const endStrike = () => {
		activeStrike = false;
		lightningDir.intensity = 0;
		lightningFill.intensity = 0;
		timeToNextStrike = randomInRange(8, 15);
	};

	const update = (delta: number) => {
		if (!activeStrike) {
			timeToNextStrike -= delta;
			if (timeToNextStrike <= 0) {
				startStrike();
			}
			return;
		}

		pulseElapsed += delta;
		const pulseDuration = pulseDurations[pulseIndex];
		const phase = Math.min(pulseElapsed / pulseDuration, 1);
		const envelope = 1 - Math.abs(phase * 2 - 1);

		const peak = pulsePeaks[pulseIndex];
		lightningDir.intensity = peak * envelope;
		lightningFill.intensity = peak * 0.24 * envelope;

		if (phase >= 1) {
			pulseIndex += 1;
			pulseElapsed = 0;
			if (pulseIndex >= pulseDurations.length) {
				endStrike();
			}
		}
	};

	return { stormGroup, update };
}
