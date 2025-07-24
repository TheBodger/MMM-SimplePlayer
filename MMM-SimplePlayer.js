Module.register("MMM-SimplePlayer", {
	defaults: {
		autoplay: false,
		playTracks: true, // play from directory
		musicDirectory: "/home/pi/MagicMirror/music",
		usePlaylist: false,
		playlistName: "defaultPlaylist.json",
		playlist: [],
		loop: false
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
			this.config.playlist = payload;
			if (this.config.autoplay && this.config.playlist.length > 0) {
				this.audio.src = this.config.playlist[this.currentTrack];
				this.audio.play();
				this.isPlaying = true;
			}
			this.updateDom();
		}
	},

	  getStyles: function () {
		return ["MMM-SimplePlayer.css"];
	},

	getDom() {
		const wrapper = document.createElement("div");
		wrapper.className = "simple-player";

		this.audio = document.createElement("audio");
		this.audio.controls = false;
		this.audio.src = this.config.playlist[this.currentTrack] || "";
		wrapper.appendChild(this.audio);

		const controls = document.createElement("div");
		controls.className = "controls";

		["Back", "Play/Pause", "Next", "Stop"].forEach(action => {
			const button = document.createElement("button");
			button.innerText = action;
			button.addEventListener("click", () => this.handleAction(action));
			controls.appendChild(button);
		});

		wrapper.appendChild(controls);
		return wrapper;
	},

	handleAction(action) {
		switch (action) {
			case "Back":
				this.currentTrack = (this.currentTrack - 1 + this.config.playlist.length) % this.config.playlist.length;
				break;
			case "Next":
				this.currentTrack = (this.currentTrack + 1) % this.config.playlist.length;
				break;
			case "Play/Pause":
				if (this.audio.paused) {
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
				this.isPlaying = false;
				return;
		}

		this.audio.src = this.config.playlist[this.currentTrack];
		if (this.isPlaying) this.audio.play();
	},

	notificationReceived(notification) {
		if (notification === "PAGE_CHANGED") {
			this.updateDom();
		}
	}
});
