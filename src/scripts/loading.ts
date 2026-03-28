import { animate, motionValue } from "motion";

const SCENE_LOADING_PROGRESS_EVENT = "scene-loading-progress";
const SCENE_LOADING_COMPLETE_EVENT = "scene-loading-complete";

export function initSceneLoader() {
	const loader = document.getElementById("scene-loader");
	const loaderPercent = document.getElementById("scene-loader-percent");
	const loaderBar = document.getElementById(
		"scene-loader-bar",
	) as HTMLElement | null;

	if (!loader || !loaderPercent || !loaderBar) {
		return;
	}

	const loaderProgress = motionValue(0);
	const fakeFloorProgress = motionValue(0);
	let loaderAnimation: ReturnType<typeof animate> | null = null;
	let isLoaderHidden = false;
	let hasSceneCompleted = false;
	let realProgress = 0;
	const loaderStartedAt = performance.now();
	const minimumVisibleMs = 1500;
	const holdBeforeCompletePercent = 95;

	const updateLoaderLabel = (value: number) => {
		const safeValue = Math.min(Math.max(value, 0), 100);
		loaderPercent.textContent = `${Math.round(safeValue)}`;
		loaderBar.style.width = `${safeValue.toFixed(2)}%`;
	};

	const animateLoaderProgressTo = (target: number, onComplete?: () => void) => {
		const safeTarget = Math.min(Math.max(target, 0), 100);
		const current = loaderProgress.get();

		if (Math.abs(current - safeTarget) < 0.01) {
			onComplete?.();
			return;
		}

		loaderAnimation?.stop();
		loaderAnimation = animate(loaderProgress, safeTarget, {
			duration: 0.24,
			ease: [0.22, 1, 0.36, 1],
			onComplete,
		});
	};

	const getCurrentProgressCap = () => {
		const elapsed = performance.now() - loaderStartedAt;
		return elapsed < minimumVisibleMs ? holdBeforeCompletePercent : 100;
	};

	const syncVisibleProgress = () => {
		if (hasSceneCompleted || isLoaderHidden) {
			return;
		}

		const cappedReal = Math.min(realProgress, getCurrentProgressCap());
		const target = Math.max(fakeFloorProgress.get(), cappedReal);
		animateLoaderProgressTo(target);
	};

	const hideLoader = () => {
		if (isLoaderHidden) {
			return;
		}

		isLoaderHidden = true;
		loaderAnimation?.stop();

		animate(
			loader,
			{ opacity: [1, 0] },
			{
				duration: 0.6,
				ease: [0.22, 1, 0.36, 1],
				onComplete: () => {
					loader.remove();
					window.removeEventListener(SCENE_LOADING_PROGRESS_EVENT, onProgress);
					window.removeEventListener(SCENE_LOADING_COMPLETE_EVENT, onComplete);
				},
			},
		);
	};

	const completeLoader = () => {
		if (isLoaderHidden) {
			return;
		}

		animateLoaderProgressTo(100, hideLoader);
	};

	const completeLoaderWhenReady = () => {
		const elapsed = performance.now() - loaderStartedAt;
		const remaining = Math.max(minimumVisibleMs - elapsed, 0);

		if (remaining > 0) {
			animateLoaderProgressTo(holdBeforeCompletePercent);
			window.setTimeout(completeLoader, remaining);
			return;
		}

		completeLoader();
	};

	const onProgress = (event: Event) => {
		if (hasSceneCompleted || isLoaderHidden) {
			return;
		}

		const customEvent = event as CustomEvent<{ progress?: number }>;
		const rawValue = customEvent.detail?.progress ?? 0;
		realProgress = Math.max(realProgress, rawValue);
		syncVisibleProgress();
	};

	const onComplete = () => {
		if (hasSceneCompleted || isLoaderHidden) {
			return;
		}

		hasSceneCompleted = true;
		completeLoaderWhenReady();
	};

	loaderProgress.on("change", updateLoaderLabel);
	fakeFloorProgress.on("change", syncVisibleProgress);
	updateLoaderLabel(0);
	fakeFloorProgress.set(50);

	window.addEventListener(SCENE_LOADING_PROGRESS_EVENT, onProgress);
	window.addEventListener(SCENE_LOADING_COMPLETE_EVENT, onComplete);
}
