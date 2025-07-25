Module.register("MMM-SimplePlayer", {
	defaults: {
		autoplay: false,
		playTracks: true, // play from directory
		musicDirectory: "/home/pi/MagicMirror/music",
		usePlaylist: false,
		playlistName: "defaultPlaylist.json",
		playlist: [],
		loop: false,
		showEvents: false,
	},

	start() {
		this.currentTrack = 0;
		this.isPlaying = false;

		if (this.config.playTracks) { this.sendNotificationToNodeHelper("SCAN_DIRECTORY", this.config.musicDirectory); }

		else if (this.config.usePlaylist) {
			this.sendNotificationToNodeHelper("LOAD_PLAYLIST", this.config.playlistName);
		}

		else {
			this.config.playlist = [];
		}

	},

	sendNotificationToNodeHelper: function (notification, payload) {
		this.sendSocketNotification(notification, payload);
	},

	socketNotificationReceived(notification, payload) {

		if (notification === "PLAYLIST_READY") {
			this.config.playlist = payload[0];
			this.config.paths = payload[1];
			if (this.config.autoplay && this.config.playlist.length > 0) {
				this.audio.src = this.config.playlist[this.currentTrack];
			}
			this.updateDom();
			this.audio.volume = 1;
		}

		if (notification === "METADATA_RESULT") {
			this.trackInfo.setAttribute("data-text", payload.common.artist + " - " + payload.common.album + " - #" + payload.common.track.no + " - " + payload.common.title);
		}

	},

	  getStyles: function () {
		  return ["MMM-SimplePlayer.css",'font-awesome.css'];
	},

	getDom() {

		const wrapper = document.createElement("div");
		wrapper.className = "simple-player";

		if (this.config.showEvents) {
			const eventLog = document.createElement("div");
			eventLog.id = "eventLog";
			eventLog.className = "small";
			eventLog.style.maxHeight = "300px";
			eventLog.style.overflowY = "auto";
			eventLog.style.border = "1px solid #ccc";
			eventLog.style.padding = "10px";
			eventLog.innerHTML = "<strong>Event Log:</strong>";
			wrapper.appendChild(eventLog);
		}

		this.audio = document.createElement("audio");

		const audioEvents = [
			'abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'ended',
			'error', 'loadeddata', 'loadedmetadata', 'loadstart', 'pause', 'play',
			'playing', 'progress', 'ratechange', 'seeked', 'seeking', 'stalled',
			'suspend', 'timeupdate', 'volumechange', 'waiting'
		];

		var preEventType = "";

		// Attach listeners for each event if required
		if (this.config.showEvents) {
			audioEvents.forEach(eventType => {
				this.audio.addEventListener(eventType, (e) => {
					if (preEventType === eventType) {
						return; // Skip if the same event is triggered consecutively
					}
					const timestamp = new Date().toLocaleTimeString();
					const logEntry = document.createElement('div');
					logEntry.textContent = `${timestamp} — ${eventType}`;
					preEventType = eventType;
					eventLog.appendChild(logEntry);
				});
			});
		}

		this.audio.controls = false;
		this.audio.volume = 0;
		this.audio.autoplay = this.config.autoplay;
		this.audio.src = this.config.playlist[this.currentTrack] || "";

		wrapper.appendChild(this.audio);

		this.isPlaying = this.audio.paused ? false : true;

		const controls = document.createElement("div");
		controls.className = "controls medium";

		const iconMap = {
			Back: "fa-backward", "Play/Pause":
				this.isPlaying ? "fa-pause" : "fa-play",
			Stop: "fa-stop",
			Next: "fa-forward",
		};

		Object.entries(iconMap).forEach(([action, icon]) => {
			const button = document.createElement("button");
			button.id = action.toLowerCase() + "Button";
			button.className = "fa-button";
			button.innerHTML = `<i class="fas ${icon} aria-hidden="true""></i>`;
			button.addEventListener("click", () => this.handleAction(action));
			controls.appendChild(button);
		});

		wrapper.appendChild(controls);

		this.trackInfo = document.createElement("div");
		this.trackInfo.id = "trackInfo";
		this.trackInfo.className = "track-info small";
		this.trackInfo.setAttribute("data-text", "Artist - Song Title");
		this.trackInfo.innerHTML = `<i class="fas fa-music"></i>`;

		wrapper.appendChild(this.trackInfo);

		return wrapper;
	},

	handleAction(action) {
		//get the Play/Pause button element so we can change its inner html to the correct icon
		const playPauseButton = document.getElementById("play/pauseButton");
		switch (action) {
			case "play":
				return;

			case "Back":
				this.currentTrack = (this.currentTrack - 1 + this.config.playlist.length) % this.config.playlist.length;
				break;

			case "Next":
				this.currentTrack = (this.currentTrack + 1) % this.config.playlist.length;
				break;

			case "Play/Pause":
				if (this.audio.paused) {
					this.audio.volume = 1; // Set volume to 1 when playing
					this.audio.play();
					this.isPlaying = true;
					playPauseButton.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i>';
					this.getTrackInfo();
					
				} else {
					this.audio.pause();
					this.isPlaying = false;
					playPauseButton.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i>';
				}
				return;

			case "Stop":
				this.audio.pause();
				this.audio.currentTime = 0;
				this.isPlaying = false;
				playPauseButton.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i>';
				return;
		}

		this.audio.src = this.config.playlist[this.currentTrack];
		this.getTrackInfo();

		if (this.isPlaying)
		{
			this.audio.play();
			playPauseButton.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i>';
		}
	},

	getTrackInfo() {
		this.sendSocketNotification("GET_METADATA", this.config.paths[this.currentTrack]);
	},

	notificationReceived(notification) {
		if (notification === "PAGE_CHANGED") {
			this.updateDom();
		}
	}
});
