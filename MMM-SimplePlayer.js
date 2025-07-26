Module.register("MMM-SimplePlayer", {
	defaults: {
		autoplay: false,
		playTracks: true, // play from directory
		musicDirectory: "modules/MMM-SimplePlayer/music",
		usePlaylist: false,
		playlistName: "examplePlaylist.m3u",

		playlist: [],
		playlistOrder: [],//Shuffled/Random ordering of the playlist

		showEvents: false,
		showMeta: true,

		startMuted: false,
		shuffle: false,
		repeat:false,
	},

	start() {

		this.currentTrack = 0;
		this.isPlaying = false;

		if (this.config.playTracks) { this.sendNotificationToNodeHelper("SCAN_DIRECTORY", this.config.musicDirectory); }

		else if (this.config.usePlaylist)
		{
			this.sendNotificationToNodeHelper("LOAD_PLAYLIST", [this.config.musicDirectory,this.config.playlistName]);
		}
		else
		{
			this.config.playlist = [];
		}

		this.iconMap = {
			Back: ["fa-backward", true],
			"Play/Pause": ["fa-play", true],
			Stop: ["fa-stop", true],
			Next: ["fa-forward", true],
			Volume: [this.config.startMuted ? "fa-volume-off" : "fa-volume-low", true],
			Shuffle: ["fa-random", this.config.shuffle],
			Repeat: ["fa-redo", this.config.repeat],
		};

	},

	sendNotificationToNodeHelper: function (notification, payload) {
		this.sendSocketNotification(notification, payload);
	},

	socketNotificationReceived(notification, payload) {

		if (notification === "PLAYLIST_READY") {
			this.config.playlist = payload[0];
			this.config.paths = payload[1];
			this.radomisePlaylist(this.config.shuffle);

			if (this.config.autoplay && this.config.playlist.length > 0) {
				this.audio.src = this.config.playlist[this.config.playlistOrder[this.currentTrack]];
			}

			this.updateDom();
		}

		if (notification === "METADATA_RESULT") {
			this.trackInfo.setAttribute("data-text", payload.common.artist + " - " + payload.common.album + " - #" + payload.common.track.no + " - " + payload.common.title);
		}

	},

	radomisePlaylist: function (shuffle)
	{
		//setup the play order as 0 - n initially

		for (let i = 0; i < this.config.playlist.length; i++)
		{
			this.config.playlistOrder[i] = i;
		}

		//now randomise if needed
		//use a seedable random function to shuffle the playlist

		if (shuffle)
		{
			this.config.playlistOrder = this.seededShuffleRange(0, this.config.playlist.length-1)
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
		event.className = "event-log-body";
		event.innerText = msg;
		eventLog.prepend(event);
	},

	getDom() {

		const wrapper = document.createElement("div");
		wrapper.className = "simple-player";

		if (this.config.showEvents) {
			const eventLog = document.createElement("div");
			eventLog.className = "small";
			eventLog.style.maxHeight = "300px";
			eventLog.style.overflowY = "auto";
			eventLog.style.border = "1px solid #ccc";
			eventLog.style.padding = "5px";
			eventLog.innerHTML = "<strong>Event Log:</strong>";

			const eventLogBody = document.createElement("div");
			eventLogBody.id = "eventLog";

			eventLog.appendChild(eventLogBody);

			wrapper.appendChild(eventLog);
		}

		this.audio = document.createElement("audio");
		this.audio.id = "audioPlayer";

		const audioEvents = [
			{ action: 'abort', required: false }, { action: 'canplay', required: false },
			{ action: 'canplaythrough', required: false }, { action: 'durationchange', required: false },
			{ action: 'emptied', required: false }, { action: 'ended', required: true },
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

			if (eventType.required || this.config.showEvents) {

				this.audio.addEventListener(eventType.action, (e) => {
					if (this.config.showEvents && !(preEventType == eventType.action))
					{ 
						const timestamp = new Date().toLocaleTimeString();
						this.addLogEntry(`${timestamp} — ${eventType.action}`);
					}
					preEventType = eventType.action;
					if (eventType.required) { this.handleAction(eventType.action); } //only handle actions that are required
				});
			}
		});
		
		this.audio.controls = false;
		this.audio.volume = this.config.startMuted ? 0 : 0.5;
		this.audio.autoplay = this.config.autoplay;
		this.audio.src = this.config.playlist[this.config.playlistOrder[this.currentTrack]] || "";
		this.getTrackInfo(1);

		wrapper.appendChild(this.audio);

		this.isPlaying = this.audio.paused ? false : true;

		const controls = document.createElement("div");
		controls.className = "controls medium";
		controls.id = "controls";

		if (!this.config.showMeta) { controls.className += this.audio.playing ? " pulsing-border" : " still-border"; }

		Object.entries(this.iconMap).forEach(([action, [icon, unDimmed]]) => {
			const button = document.createElement("button");
			button.id = action.toLowerCase() + "Button";
			button.className = "fa-button";
			button.addEventListener("click", () => this.handleAction(action));
			this.setupButton(action, icon, unDimmed, button); //pass button as it may not be available yet
			var x = 1;
			controls.appendChild(button);
		});

		wrapper.appendChild(controls);

		if (this.config.showMeta)
		{

			this.trackInfo = document.createElement("div");
			this.trackInfo.id = "trackInfo";
			this.trackInfo.className = "track-info small";
			this.trackInfo.setAttribute("data-text", "Artist - Song Title");
			this.trackInfo.innerHTML = `<i class="fas fa-music"></i>`;

			wrapper.appendChild(this.trackInfo);

		}

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

	setupButton(action, icon, unDimmed, buttonElement) {

		//if button element passed always use it

		if (buttonElement) {
			buttonT = buttonElement;
		}
		else
		{
			var buttonT = document.getElementById(action.toLowerCase() + "Button");
		}

		buttonT.innerHTML = `<i class="fas ${icon} ${unDimmed ? "" : "dimmedButton"}" aria-hidden="true"></i>`;

	},

	handleAction(action) {

		if (this.config.showEvents) { this.addLogEntry(`Handling: ${action}`); }

		const volumeButton = document.getElementById("volumeButton");

		switch (action) {

			case "ended":
				//play the next track in the playlist, if at end start again if repeat is enabled

				if (this.currentTrack + 1 >= this.config.playlist.length) {
					if (this.config.repeat) {
						this.handleAction("Next");
					}
					else {
						this.currentTrack = 0; //reset to the first track
					}
				}
				else
				{
					this.handleAction("Next");
				}

				return;

			case "Shuffle":
				// Toggles the shuffle mode, and randomises the playlist if shuffle is now enabled
				this.config.shuffle = !this.config.shuffle;
				this.radomisePlaylist(this.config.shuffle);
				if (this.config.showEvents) { this.addLogEntry(`Handling: ${this.config.playlistOrder}`); }
				this.setupButton(action, this.iconMap[action][0], this.config.shuffle,null);
				return;

			case "Repeat":
				// Toggles the repeat mode
				this.config.repeat = !this.config.repeat;
				this.setupButton(action, this.iconMap[action][0], this.config.repeat,null);
				return;

			case "playing":
				this.showPlayPause(action);
				this.isPlaying = true;
				if (!this.config.showMeta) { this.setBorder(); }
				return;

			case "pause":
				this.showPlayPause(action);
				this.isPlaying = false;
				if (!this.config.showMeta) { this.setBorder(); }
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
				this.audio.src = this.config.playlist[this.config.playlistOrder[this.currentTrack]];
				this.getTrackInfo(2);
				//if not autoplay then make sure that the play control is showing the play icon and the track is teeded up ready to go
				if (!this.config.autoplay) {
					this.handleAction("Stop");
				}
				return;

			case "Next":
				this.currentTrack = (this.currentTrack + 1) % this.config.playlist.length;
				this.audio.src = this.config.playlist[this.config.playlistOrder[this.currentTrack]];
				this.getTrackInfo(3);
				//if not autoplay then make sure that the play control is showing the play icon and the track is teeded up ready to go
				if (!this.config.autoplay) {
					this.handleAction("Stop");
				}
				return;

			case "Play/Pause":
				if (!this.audio.error) {
					if (this.audio.paused) {
						if (this.audio.volume == 0) { this.audio.volume = 0.5; } // Set volume to 0.5 when playing if it was muted
						if (!this.audio.error)
							this.audio.play();
						this.isPlaying = true;

					} else {
						this.audio.pause();
						this.isPlaying = false;
					}
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

	setBorder() {

		const controls = document.getElementById("controls");

		//replace the border class old,with new

		controls.classList.replace("still-border", !this.audio.paused ? "pulsing-border" : "still-border")
		controls.classList.replace("pulsing-border", !this.audio.paused ? "pulsing-border" : "still-border")
;
	},

	getTrackInfo(id) {

		if (!this.config.paths || !this.config.paths[this.currentTrack]) { return; }

		if (this.config.showMeta) {
			this.sendSocketNotification("GET_METADATA", this.config.paths[this.config.playlistOrder[this.currentTrack]]);
		}
	},

	notificationReceived(notification) {
		if (notification === "PAGE_CHANGED") {
			this.updateDom();
		}
	},

	seededShuffleRange(a, b, seed = Date.now()) {
		// Generate range of integers
		const range = Array.from({ length: b - a + 1 }, (_, i) => a + i);

		// Simple seedable random number generator (Mulberry32)
		function mulberry32(s) {
			return function ()
			{
				s |= 0;
				s = s + 0x6D2B79F5 | 0;
				let t = Math.imul(s ^ s >>> 15, 1 | s);
				t = t + (t >>> 7) | 0;
				return ((t ^ t >>> 14) >>> 0) / 4294967296;
			};
		}

		// Shuffle using the seeded RNG
		const random = mulberry32(seed);

		for (let i = range.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[range[i], range[j]] = [range[j], range[i]];
		}

		return range;

	}

});
