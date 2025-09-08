class ImageSlideshow {

	constructor(displayElement) {
		this.displayElement = displayElement;
		this.playlist = [];
		this.currentIndex = 0;
		this.slideDuration = 5000; // ms
		this.slideFade = 1000; // ms
		this.timer = null;
		this.remainingTime = null;
		this.lastStartTime = null;
		this.state = 'stopped'; // 'playing', 'paused', 'stopped'

		this.slideShowControls = "";

		this.ssControlPositions = [
			{ "position": ["bottom", "middle1"] },
			{ "position": ["bottom", "middle2"] },
			{ "position": ["middle", "right"] },
			{ "position": ["middle", "left"] }
		];

		this.ssControlList = [['ssPlay', "Play", "fa-play"], ['ssStop', "Stop", "fa-stop"], ['ssNext', "Next", "fa-forward"], ['ssPrev', "Prev", "fa-backward"]];

	}

	setDuration(ms) {
		this.slideDuration = ms;
	}

	setFade(ms) {
		this.slideFade = ms;
	}

	play() {

		this.state = 'playing';
		this.lastStartTime = Date.now();
		clearTimeout(this.timer);

		if (this.state === 'paused') {
			this.timer = setTimeout(() => this.next(), this.remainingTime);
		} else {
			this.showImage(this.currentIndex, true);
			this.timer = setTimeout(() => this.next(), this.slideDuration);
		}
	}

	pause() {
		if (this.state === 'playing') {
			clearTimeout(this.timer);
			this.remainingTime = this.slideDuration - (Date.now() - this.lastStartTime);
			this.state = 'paused';
		}
	}

	stop() {
		clearTimeout(this.timer);
		this.state = 'stopped';
		this.remainingTime = null;
	}

	next() {
		clearTimeout(this.timer);
		this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
		this.showImage(this.currentIndex, true);
		if (this.state === 'playing') {
			this.lastStartTime = Date.now();
			this.timer = setTimeout(() => this.next(), this.slideDuration);
		}
	}

	prev() {
		clearTimeout(this.timer);
		this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
		this.showImage(this.currentIndex, true);
		if (this.state === 'playing') {
			this.lastStartTime = Date.now();
			this.timer = setTimeout(() => this.next(), this.slideDuration);
		}
	}

	showImage(index, useFade = false) {
		const url = this.playlist[index];
		if (!url) return;

		const slideShowImg = document.createElement('img');

		slideShowImg.style.transition = useFade ? `opacity ${this.slideFade}ms` : '';
		slideShowImg.style.opacity = '0';

		slideShowImg.id = "slideShowImg";
		
		slideShowImg.src = url;

		this.displayElement.innerHTML = '';
		this.displayElement.appendChild(slideShowImg);
		this.displayElement.appendChild(this.slideShowControls);

		requestAnimationFrame(() => {
			slideShowImg.style.opacity = '1';
		});
	}

	setPlaylist(json) {
		this.playlist = Array.isArray(json) ? json : [];
		this.currentIndex = 0;
	}

	addImage(url) {
		this.playlist.push(url);
	}

	removeImage(url) {
		this.playlist = this.playlist.filter(img => img !== url);
		if (this.currentIndex >= this.playlist.length) {
			this.currentIndex = 0;
		}
	}

	clear() {
		this.stop();
		this.playlist = [];
		this.currentIndex = 0;
		this.slideDuration = 5000;
		this.slideFade = 1000;
	}

	addControls(moduleRef) {

		//['ssPlay', "Play", "fa-play"]
		//add the slideshow controls as a discrete child div
		this.slideShowControls = document.createElement("div");
		this.slideShowControls.id = "slideShowControls";
		this.slideShowControls.className = "slideShow-controls";

		//positioning of the buttons is relative to the slidshow div
		//the ssPrev will be middle left, ssNext middle right, ssPlay bottom left, ssStop bottom right

		this.ssControlList.forEach(action => {

			const button = document.createElement("button");
			button.id = action[0].toLowerCase() + "Button";

			const valign = this.ssControlPositions[this.ssControlList.indexOf(action)].position[0];
			const halign = this.ssControlPositions[this.ssControlList.indexOf(action)].position[1];
			button.className = "fa-button  tooltip-container " + valign + "-" + halign;

			button.addEventListener("click", () => moduleRef.handleAction(action[0]));
			moduleRef.setupButton(action[0], action[2], true, button); //pass button as it may not be available yet

			button.addEventListener('touchstart', handleTouchStart);
			button.addEventListener('touchend', handleTouchEnd);

			this.slideShowControls.appendChild(button);

		});
		return this.slideShowControls;

	}

}
