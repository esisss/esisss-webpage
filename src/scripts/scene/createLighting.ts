import * as THREE from "three";

export interface SceneLighting {
	lightingGroup: THREE.Group;
	hemiLight: THREE.HemisphereLight;
	dirLight: THREE.DirectionalLight;
	spotLight: THREE.SpotLight;
}

export function createLighting(): SceneLighting {
	const lightingGroup = new THREE.Group();

	// HemisphereLight: Ambient illumination simulating sky and ground bounce
	const skyColor = 0xc9d6e3; // Cool blue-white overcast sky
	const groundColor = 0x4a5568; // Dark gray bounced light from mountains
	const intensity = 3;
	const hemiLight = new THREE.HemisphereLight(skyColor, groundColor, intensity);
	lightingGroup.add(hemiLight);

	// DirectionalLight: Moon-tinted key light
	const dirColor = 0xffe18c; // More yellow moonlight
	const dirIntensity = 0.3; // Low contrast
	const dirLight = new THREE.DirectionalLight(dirColor, dirIntensity);
	dirLight.position.set(50, 200, -400); // High angle
	lightingGroup.add(dirLight);

	// SpotLight: Soft key light for lake response
	const spotLight = new THREE.SpotLight(
		0xfff1da,
		1.7,
		180,
		Math.PI / 6,
		0.45,
		1.5,
	);
	spotLight.position.set(-30, 36, -36);
	spotLight.target.position.set(-8, -10, -62);
	lightingGroup.add(spotLight);
	lightingGroup.add(spotLight.target);

	return { lightingGroup, hemiLight, dirLight, spotLight };
}
