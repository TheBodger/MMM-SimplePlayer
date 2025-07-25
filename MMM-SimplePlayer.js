Module.register("MMM-SimplePlayer", {
	defaults: {
		autoplay: false,
		playTracks: true, // play from directory
		musicDirectory: "/home/pi/MagicMirror/music",
		usePlaylist: false,
		playlistName: "defaultPlaylist.m3u",
		playlist: [],
		loop: false,
		showEvents: false,
		startMuted: false,
	},

	start() {
		this.currentTrack = 0;
		this.isPlaying = false;

		if (this.config.playTracks) { this.sendNotificationToNodeHelper("SCAN_DIRECTORY", this.config.musicDirectory); }

		else if (this.config.usePlaylist) {
			this.sendNotificationToNodeHelper("LOAD_PLAYLIST", [this.config.musicDirectory,this.config.playlistName]);
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
		}

		if (notification === "METADATA_RESULT") {
			this.trackInfo.setAttribute("data-text", payload.common.artist + " - " + payload.common.album + " - #" + payload.common.track.no + " - " + payload.common.title);
		}

	},

	  getStyles: function () {
		  return ["MMM-SimplePlayer.css",'font-awesome.css'];
	},

	addLogEntry(msg) {
		if (!this.config.showEvents) { return };
		const eventLog = document.getElementById("eventLog");
		if (!eventLog) {
			console.error("Event log element not found.");
			return;
		}
		const event = document.createElement("p");
		event.innerText = msg;
		eventLog.appendChild(event);
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
			{ action: 'abort', required: false }, { action: 'canplay', required: false },
			{ action: 'canplaythrough', required: false }, { action: 'durationchange', required: false },
			{ action: 'emptied', required: false }, { action: 'ended', required: false },
			{ action: 'suspend', required: false }, { action: 'timeupdate', required: false },
			{ action: 'volumechange', required: true }, { action: 'waiting', required: false },
			{ action: 'playing', required: true }, { action: 'progress', required: false },
			{ action: 'ratechange', required: false }, { action: 'seeked', required: false },
			{ action: 'seeking', required: false }, { action: 'stalled', required: false },
			{ action: 'error', required: false }, { action: 'loadeddata', required: false },
			{ action: 'loadedmetadata', required: false }, { action: 'loadstart', required: false },
			{ action: 'pause', required: true }, { action: 'play', required: false },
		];

		var preEventType = "";

		// Attach listeners for each event if required
		
		audioEvents.forEach(eventType => {

			if ((eventType.required && !this.config.showEvents) || this.config.showEvents) {

				this.audio.addEventListener(eventType.action, (e) => {
					if (this.config.showEvents && !preEventType === eventType)
					{ 
						const timestamp = new Date().toLocaleTimeString();
						this.addLogEntry(`${timestamp} — ${eventType}`);
						preEventType = eventType;
					}
					if (eventType.required) { this.handleAction(eventType.action) }; //only handle actions that are required
				});
			}
		});
		
		this.audio.controls = false;
		this.audio.volume = this.config.startMuted ? 0 : 1;
		this.audio.autoplay = this.config.autoplay;
		this.audio.src = this.config.playlist[this.currentTrack] || "";
		this.getTrackInfo(1);

		wrapper.appendChild(this.audio);

		this.isPlaying = this.audio.paused ? false : true;

		const controls = document.createElement("div");
		controls.className = "controls medium";

		const iconMap = {
			Back: "fa-backward",
			"Play/Pause": this.isPlaying ? "fa-pause" : "fa-play",
			Stop: "fa-stop",
			Next: "fa-forward",
			Volume: this.audio.volume === 0 ? "fa-volume-off" : this.audio.volume < 0.51 ? "fa-volume-low" : "fa-volume-high",
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

	showPlayPause(action) {
		//get the Play/Pause button element so we can change its inner html to the correct icon

		const playPauseButton = document.getElementById("play/pauseButton");

		if (action === "playing") {
			playPauseButton.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i>';
		}
		else if (action === "pause" || action === "Stop") {
			playPauseButton.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i>';
		}
	},

	handleAction(action) {

		const volumeButton = document.getElementById("volumeButton");

		switch (action) {

			case "playing":
				this.showPlayPause(action);
				this.isPlaying = true;
				return;

			case "pause":
				this.showPlayPause(action);
				this.isPlaying = false;
				return;

			case "volumechange":
				if (this.config.showEvents) { this.addLogEntry(`Event volumeChange: ${this.audio.volume}`); }
				if (this.audio.volume > 0 && this.audio.volume < 0.51) {
					volumeButton.innerHTML = '<i class="fas fa-volume-low" aria-hidden="true"></i>';
				}
				else if (this.audio.volume > 0.5)
				{
					volumeButton.innerHTML = '<i class="fas fa-volume-high" aria-hidden="true"></i>';
				}
				else
				{
					volumeButton.innerHTML = '<i class="fas fa-volume-off" aria-hidden="true"></i>';
				}
				return;

			case "Volume":
			
				if (this.audio.volume == 0)
				{
					this.audio.volume = 0.5; 
				}
				else if (this.audio.volume > 0.5)
				{
					this.audio.volume = 0;
				}
				else
				{
					this.audio.volume = 1; 
				}
				return;

			case "Back":
				this.currentTrack = (this.currentTrack - 1 + this.config.playlist.length) % this.config.playlist.length;
				this.audio.src = this.config.playlist[this.currentTrack];
				this.getTrackInfo(2);
				return;

			case "Next":
				this.currentTrack = (this.currentTrack + 1) % this.config.playlist.length;
				this.audio.src = this.config.playlist[this.currentTrack];
				this.getTrackInfo(3);
				return;

			case "Play/Pause":
				if (this.audio.paused) {
					if (this.audio.volume == 0) { this.audio.volume = 0.5; } // Set volume to 0.5 when playing if it was muted
					this.audio.play();
					this.isPlaying = true;
					
				} else {
					this.audio.pause();
					this.isPlaying = false;
				}
				return;

			case "Stop":
				this.audio.pause();
				this.audio.currentTime = 0;
				this.showPlayPause(action);
				this.isPlaying = false;
				return;
		}

	},

	getTrackInfo(id) {

		if (!this.config.paths || !this.config.paths[this.currentTrack]) { return; }

		this.sendSocketNotification("GET_METADATA", this.config.paths[this.currentTrack]);
	},

	notificationReceived(notification) {
		if (notification === "PAGE_CHANGED") {
			this.updateDom();
		}
	}
});
