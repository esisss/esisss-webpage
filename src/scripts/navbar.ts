import { animate, motionValue } from "motion";

export function initNavbarEffects() {
	const overlay = document.getElementById("scene-blur-overlay");
	const header = document.getElementById("site-header");
	const headerTitle = document.getElementById("site-header-title");

	if (!overlay && !header) {
		return;
	}

	const maxOverlayStrength = 0.8;
	const progress = motionValue(0);
	let currentAnimation: ReturnType<typeof animate> | null = null;

	const getScrollProgress = () => {
		const revealDistance = window.innerHeight * 0.9;
		if (revealDistance <= 0) {
			return 0;
		}

		const nextProgress = window.scrollY / revealDistance;
		return Math.min(Math.max(nextProgress, 0), 1);
	};

	const applyVisuals = (value: number) => {
		if (overlay) {
			const overlayStrength = value * maxOverlayStrength;
			overlay.style.setProperty(
				"--scene-overlay-strength",
				overlayStrength.toFixed(4),
			);
		}

		if (header) {
			header.style.backgroundColor = `rgb(5 9 14 / ${value.toFixed(4)})`;
			header.style.borderBottomColor = `rgb(255 255 255 / ${(value * 0.18).toFixed(4)})`;
			header.style.backdropFilter = `blur(${(value * 10).toFixed(3)}px)`;
		}

		if (headerTitle) {
			const textOpacity = 0.72 + value * 0.28;
			const shadowOpacity = 0.35 + value * 0.35;
			headerTitle.style.color = `rgb(255 255 255 / ${textOpacity.toFixed(4)})`;
			headerTitle.style.textShadow = `0 2px 14px rgb(0 0 0 / ${shadowOpacity.toFixed(4)})`;
		}
	};

	const updateTarget = () => {
		currentAnimation?.stop();
		currentAnimation = animate(progress, getScrollProgress(), {
			duration: 0.35,
			ease: [0.22, 1, 0.36, 1],
		});
	};

	progress.on("change", applyVisuals);
	applyVisuals(0);
	window.addEventListener("scroll", updateTarget, { passive: true });
	window.addEventListener("resize", updateTarget);
	updateTarget();
}
