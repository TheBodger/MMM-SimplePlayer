let pressTimer;
const container = document.querySelector('.tooltip-container');

function handleTouchStart() {
	pressTimer = setTimeout(() => {
		container.classList.add('show-tooltip');
	}, 500); // 500ms threshold for long press
}

function handleTouchEnd() {
	clearTimeout(pressTimer);
	container.classList.remove('show-tooltip');
}
