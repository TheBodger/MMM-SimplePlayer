Module.register("MMM-SimplePlayer", {
	defaults: {
		autoplay: true,
		playTracks: true, // play from directory
		musicDirectory: "modules/MMM-SimplePlayer/music",
		usePlaylist: false,
		playlistName: "examplePlaylist.m3u",
		DLNAPlaylistName: "dlnaPlaylist.m3u",

		playlist: [],
		images: [], // contains any images (photos) returned from the DLNA server
		playlistOrder: [],//Shuffled/Random ordering of the playlist

		showDLNA: false, //enables DLNA support will load any DLNA servers found initially
		DLNAPlaylist: [], //holds the DLNA playlist
		art: [], //matching art for the DLNA play list
		
		showEvents: false,
		showMeta: true,

		showAlbumArt: false, //if art is available (usually just DLNA) show it as background to the DIV

		showSlideShowControls: false,
		slideShowDuration: 10000, //10 seconds
		slideShowFadeDuration:2000, //2 seconds
		showSlideShow: false,
		slideShowSize: "medium",

		startMuted: false,
		shuffle: false,
		repeat: false,

		showMini:false, //start with miniplayer
		miniplayercontrols: ['Back', 'Play', 'Next', 'MiniPlayer'],

		controlsSize: "medium",
		defaultplayercontrols: ['Back', 'Play', 'Stop', 'Next', 'Volume', 'Shuffle', 'Repeat', 'MiniPlayer', 'DLNA'],

		supportedAudioExt: ['MP3', 'WAV', 'OGG'],
		debug: false,
	},

	startAudio()
	{
		this.requestTracks();
		if (this.config.showDLNA) {
			this.requestServers();
		}
	},

	start()
	{

		this.sendNotificationToNodeHelper("CONFIG", { config: { debug: this.config.debug } });

		this.currentTrack = 0;
		this.isPlaying = false;
		this.DLNAItems = [];
		this.DLNAimages = [];
		//this.DLNAItemsCurrentDisplayIdx = 0;
		this.DLNAIdxs = [0]; //will contain the idx of item displayed in the current level , used when scrolling left and right, set when scrolling up and down
		this.DLNACurrentIdx = 0; // points to the current level, ++ -- left and right scrolling
		this.returnedDLNAItems = [{ is: "-99", type: "server", name: "No DLNA Servers" }];
		this.loadDLNAItems();
		this.DLNAServersLoaded = false;
		this.currentServerID = 0;
		this.trackInfoMsg = "";

		this.slideShow = null;

		this.config.showingDLNA = false; //used to toggle the DLNA button
		this.showingMini = this.config.showMini; //used to toggle the Miniplayer button

		this.startAudio();

		this.iconMap =
		{
			Back: ["fa-backward", true],
			Play: ["fa-play", true],
			Stop: ["fa-stop", true],
			Next: ["fa-forward", true],
			Volume: [this.config.startMuted ? "fa-volume-off" : "fa-volume-low", true],
			Shuffle: ["fa-random", this.config.shuffle],
			Repeat: ["fa-redo", this.config.repeat],
			MiniPlayer: ["fa-minimize", true],
		}

		if (this.config.showDLNA)
		{
			this.iconMap["DLNA"] = ["fa-server", this.config.showingDLNA];
		}
		else
		{
			this.iconMap["DLNA_Not_Available"] = ["fa-ban", false];
			const index = this.config.defaultplayercontrols.indexOf('DLNA');
			if (index !== -1)
			{
				this.config.defaultplayercontrols[index] = 'DLNA_Not_Available';
			}
		}

		this.DLNAIconMap =
		{
			ScrollDown: ["fa-arrow-down", true],	//only if entries on the tree on same level are below this one
			ScrollUp: ["fa-arrow-up", true],		//only if entries on the tree on same level are above this one
			Add: ["fa-plus", true],			//add the current displayed node and all children to the DLNA playlist
			Remove: ["fa-minus", true],		//removes the current displayed node and all children from the DLNA playlist
			Clear: ["fa-trash", true],		 //clears the current DLNA playlist
			Save: ["fa-file-export", true], //only when entries are in the DLNA playlist
			Open: ["fa-file-import", true],  //only if a saved playlist exists, loads into the DLNA playlist
			ScrollLeft: ["fa-arrow-left", true],   //only if entries in the tree to the left
			ScrollRight: ["fa-arrow-right", true], //only if entries in the tree to the right; if no entries, will attempt to get new folders from the DLNA client using the ID of the displayed node
		}

	},

	sendNotificationToNodeHelper: function (notification, payload) {
		this.sendSocketNotification(notification, payload);
	},

	isSupportedAudio(url) {
		if (!url)
		{
			var x = 1;
		}
		const extMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
		if (!extMatch) return false;

		const ext = extMatch[1].toUpperCase();
		return this.config.supportedAudioExt.includes(ext);
	},

	setAudioSrc(src) //validates it is playable in HTML5 audio player
	{
		//html audio player only currently supports MP3 WAV OGG NOT native windows WMA

		this.trackInfoMsg = "";
		//console.log("src:", src);

		if (this.isSupportedAudio(src))
		{
			this.audio.src = src;
		}
		else
		{
			this.trackInfoMsg = " - Unsupported audio";
			this.audio.src = null;
		}

		this.getTrackInfo();

		if (this.config.showAlbumArt)
		{
			//console.log("showing art");
			this.showAlbumArt();
		}
	},

	socketNotificationReceived(notification, payload)
	{
		this.addLogEntry(`Received: ${notification}`);

		if (notification === "PLAYLIST_READY")
		{
			this.config.playlist = payload[0];
			this.config.images = payload[1];
			this.config.art = payload[2];
			this.radomisePlaylist(this.config.shuffle);

			if (this.config.autoplay && this.config.playlist.length > 0)
			{
				this.setAudioSrc(this.config.playlist[this.config.playlistOrder[this.currentTrack]]);
			}

			if (this.config.showSlideShow && this.config.images && this.config.images.length > 0)
			{
				this.slideShow.setPlaylist(this.config.images);
				this.slideShow.play();
			}

		}

		//handle DLNA - a  list of DLNA items is returned from node helper with the notification "NEW_DLNA_ITEMS"
		//these replace the DLNA_items list held locally in the module
		//the DLNA items display logic is then handled through the handleDLNAevents function and the available DLNA list.
		if (notification === "NEW_DLNA_ITEMS") {
			
			this.returnedDLNAItems = payload;
			//this.DLNAItemsCurrentDisplayIdx = 0;

			if (this.config.showEvents) {
				this.addLogEntry(`DLNA Playlist Updated:${this.DLNAItems.length} items`);
			}

			this.loadDLNAItems();
			this.showDLNAItems();

		}

		if (notification === "METADATA_RESULT") {
			this.trackInfo.setAttribute("data-text", payload.common.artist + " - " + payload.common.album + " - #" + payload.common.track.no + " - " + payload.common.title + this.trackInfoMsg);
		}

	},

	radomisePlaylist: function (shuffle) {
		//setup the play order as 0 - n initially

		for (let i = 0; i < this.config.playlist.length; i++) {
			this.config.playlistOrder[i] = i;
		}

		//now randomise if needed
		//use a seedable random function to shuffle the playlist

		if (shuffle) {
			this.config.playlistOrder = this.seededShuffleRange(0, this.config.playlist.length - 1)
		}

	},

	getStyles: function () {
		return ["MMM-SimplePlayer.css", 'font-awesome.css'];
	},

	getScripts: function () {
		return [
			this.file('touchToolTipHandler.js'), // this file will be loaded straight from the module folder.
			this.file('slideShow.js'), // this file will be loaded straight from the module folder.
		]
	},

	addLogEntry(msg) {
		if (!this.config.showEvents) { return };
		const eventLog = document.getElementById("eventLogbody");
		if (!eventLog) {
			if (this.config.debug) console.error("Event log element not found.");
			return;
		}
		const event = document.createElement("p");
		event.className = "event-log-body";
		event.innerText = msg;
		eventLog.prepend(event);
	},

	loadDLNAItems() {
		this.DLNAItems = [];

		this.returnedDLNAItems.forEach(DLNAItem => {

			if (DLNAItem.type == "server") {
				this.DLNAServersLoaded = true;
				this.DLNACurrentIdx = 0;
			} //received a server

			this.DLNAItems.push({ id: DLNAItem.id, type: DLNAItem.type, item: DLNAItem.name, content: DLNAItem.content });

		});

		if (this.DLNAIdxs[this.DLNACurrentIdx] > this.DLNAItems.length - 1) { this.DLNAIdxs[this.DLNACurrentIdx] = 0; };

		//console.log("Showing DLNAitems 1", this.DLNAItems.length, " ", JSON.stringify(this.DLNAItems))
	},

	showDLNAItems() {

		//show the item in this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]] in the DLNAitem div
		var showItem = this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]];

		if (!showItem) {
			var x = 1;
		}

		if (showItem.type == "server") {
			this.currentServerID = showItem.id;
			//this.DLNAIdxs[0] = 0; //seems to defat the proper scolling of servers
			//this.DLNACurrentIdx = 0; 
		}

		var showContent = ` ${((showItem.content) ? (showItem.content.album) ? showItem.content.album : "" : "")}`;

		this.DLNAItem.setAttribute("data-text", showItem.item + showContent);

		if (this.config.showAlbumArt && showItem.content && showItem.content.albumArt) { this.showDLNAAlbumArt(showItem.content.albumArt) }

	},

	buildDom(controlList)
	{

		const wrapper = document.createElement("div");
		wrapper.className = "simple-player";
		wrapper.id = "simple-player";

		if (this.config.showAlbumArt) { wrapper.setAttribute("art", ""); }

		if (this.config.showSlideShow)
		{
			//add the slidshow as a discrete div

			const slideShow = document.createElement("div");

			slideShow.id = "slideShow";
			slideShow.className = "slideShow " + this.config.slideShowSize + "-img";

			this.slideShow = new ImageSlideshow(slideShow);
			this.slideShow.setDuration(this.config.slideShowDuration);
			this.slideShow.setFade(this.config.slideShowFadeDuration);

			if (this.config.showSlideShowControls)
			{
				slideShow.appendChild(this.slideShow.addControls(this));	
			}

			wrapper.appendChild(slideShow);

		}

		if (this.config.showEvents || this.config.showAlbumArt) {
			const eventLog = document.createElement("div");
			eventLog.className = "small muted-background";
			eventLog.id = "eventLog";
			eventLog.style.maxHeight = "6em";
			eventLog.style.height = "5em";
			eventLog.style.overflowY = "auto";
			eventLog.style.padding = "1em";
			eventLog.innerHTML = "&nbsp;";

			if (this.config.showEvents)
			{
				eventLog.innerHTML = "<strong>Event Log:</strong>";
				eventLog.style.border = "1px solid #ccc";

				const eventLogBody = document.createElement("div");
				eventLogBody.id = "eventLogbody";

				eventLog.appendChild(eventLogBody);
			}

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
					if (this.config.showEvents && !(preEventType == eventType.action)) {
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

		wrapper.appendChild(this.audio);

		this.isPlaying = this.audio.paused ? false : true;

		const controls = document.createElement("div");
		controls.className = "controls " + this.config.controlsSize;
		controls.id = "controls";

		if (!this.config.showMeta) { controls.className += this.audio.playing ? " pulsing-border" : " still-border"; }

		controlList.forEach(action => {

			const [icon, unDimmed] = this.iconMap[action];

			const button = document.createElement("button");
			button.id = action.toLowerCase() + "Button";
			button.className = "fa-button  tooltip-container";
			button.addEventListener("click", () => this.handleAction(action));
			this.setupButton(action, icon, unDimmed, button); //pass button as it may not be available yet
			button.addEventListener('touchstart', handleTouchStart);
			button.addEventListener('touchend', handleTouchEnd);
			controls.appendChild(button);

			this.addTooltip(button, action);

		});

		wrapper.appendChild(controls);

		if (this.config.showMeta) {

			this.trackInfo = document.createElement("div");
			this.trackInfo.id = "trackInfo";
			this.trackInfo.className = "track-info small";
			this.trackInfo.setAttribute("data-text", "Artist - Song Title");
			this.trackInfo.innerHTML = `<i class="fas fa-music"></i>`;

			controls.appendChild(this.trackInfo);

		}

		if (this.config.showDLNA) {

			this.DLNAItem = document.createElement("div");
			this.DLNAItem.id = "DLNAItem";
			this.DLNAItem.className = 'track-info ' + this.config.controlsSize;
			//console.log("Showing DLNAitems 2", this.DLNAItems.length)
			this.showDLNAItems();
			this.DLNAItem.innerHTML = `&nbsp;`;

			controls.appendChild(this.DLNAItem);

			const DLNAControls = document.createElement("div");
			DLNAControls.className = "controls " + this.config.controlsSize;;
			DLNAControls.id = "DLNAControls";

			Object.entries(this.DLNAIconMap).forEach(([action, [icon, unDimmed]]) => {
				const button = document.createElement("button");
				button.id = action.toLowerCase() + "Button";
				button.className = "fa-button tooltip-container";
				button.addEventListener("click", () => this.handleDLNAAction(action));
				this.setupButton(action, icon, unDimmed, button); //pass button as it may not be available yet
				DLNAControls.appendChild(button);

				this.addTooltip(button, action);

			});

			controls.appendChild(DLNAControls);
		}

		return wrapper;

	},

	getDom() {
		if (this.config.debug) console.log("GetDom");
		var wrapper='';
		if (this.showingMini)
		{
			wrapper = this.buildDom(this.config.miniplayercontrols);
		}
		else
		{
			wrapper = this.buildDom(this.config.defaultplayercontrols);
		}

		return wrapper;
	},

	addTooltip(buttonElement, toolTip)
	{

		const tooltip = document.createElement("span");
		tooltip.className = "tooltip-text";
		tooltip.innerText = toolTip.replace(/([A-Z])/g, ' $1');
		buttonElement.appendChild(tooltip);
	},

	showPlayPause(action)
	{
		//get the Play/Pause button element so we can change its inner html to the correct icon

		const playPauseButton = document.getElementById("playButton");

		//need the tooltip added here!!

		if (action === "playing")
		{
			playPauseButton.innerHTML = '<i class="fas fa-pause" aria-hidden="true"></i>';
			this.addTooltip(playPauseButton, 'Pause');
		}
		else if (action === "pause" || action === "Stop")
		{
			playPauseButton.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i>';
			this.addTooltip(playPauseButton, 'Play');
		}
	},

	setupButton(action, icon, unDimmed, buttonElement)
	{

		//if button element passed always use it

		if (buttonElement) {
			buttonT = buttonElement;
		}
		else
		{
			var buttonT = document.getElementById(action.toLowerCase() + "Button");
		}

		buttonT.innerHTML = `<i id="${action}icon" class="fas ${icon} ${unDimmed ? "" : "dimmedButton"}" aria-hidden="true"></i>`;

		this.addTooltip(buttonT, action);

	},

	handleDLNAAction(action)
	{
		if (this.config.showEvents) { this.addLogEntry(`Handling: ${action}`); }

		//the following actions control how the DLNAItems are displayed within the DLNAItem div
		//if there are no DLNA items then the DLNAItem div will not be displayed
		//the DLNA items is a one dimension list of names of the DLNA items, that can be scrolled up and down using the ScrollDown and ScrollUp actions.
		//if the scrollRight or scrollLeft action is handled, then the current displayed item and the action will be passed to the node helper to get the next list DLNA items

		switch (action) {
			case "ScrollDown":
				//scroll down the DLNA items, if there are more items to display using the idx and length

				this.DLNAIdxs[this.DLNACurrentIdx]++;
				//this.DLNAItemsCurrentDisplayIdx++

				this.DLNAIdxs[this.DLNACurrentIdx] = (this.DLNAIdxs[this.DLNACurrentIdx] > (this.DLNAItems.length - 1)) ? 0 : this.DLNAIdxs[this.DLNACurrentIdx]

				//console.log("Showing DLNAitems 3", this.DLNAItems.length)
				this.showDLNAItems();
				return;

			case "ScrollUp":
				//scroll up the DLNA items, if there are more items to display
				this.DLNAIdxs[this.DLNACurrentIdx]--;
				this.DLNAIdxs[this.DLNACurrentIdx] = (this.DLNAIdxs[this.DLNACurrentIdx] < 0) ? (this.DLNAItems.length - 1) : this.DLNAIdxs[this.DLNACurrentIdx];
				//console.log("Showing DLNAitems 4", this.DLNAItems.length)
				this.showDLNAItems();
				return;


			case "Add":
				//add the current displayed item and all children to the DLNA playlist
				this.sendNotificationToNodeHelper("ADD_DLNA_ITEM", { action: action, currentServerID: this.currentServerID, item: this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]], returnPlaylist: this.config.showingDLNA });
				return;
			case "Remove":
				//removes the current displayed item and all children from the DLNA playlist
				this.sendNotificationToNodeHelper("REMOVE_DLNA_ITEM", { action: action, currentServerID: this.currentServerID, item: this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]], returnPlaylist: this.config.showingDLNA });
				return;

			case "Clear":
				//clears the current DLNA playlist
				this.DLNACurrentIdx = 0;
				this.DLNAIdxs = [0];
				this.sendNotificationToNodeHelper("CLEAR_DLNA_PLAYLIST", { returnPlaylist: this.config.showingDLNA });
				return;
			case "Save":
				//saves the current DLNA playlist to a file
				this.sendNotificationToNodeHelper("SAVE_DLNA_PLAYLIST", { musicDirectory:this.config.musicDirectory, DLNAPlaylistName:this.config.DLNAPlaylistName });
				return;
			case "Open":
				//opens a saved DLNA playlist file and loads it into the DLNA playlist
				this.sendNotificationToNodeHelper("OPEN_DLNA_PLAYLIST", { musicDirectory: this.config.musicDirectory, DLNAPlaylistName: this.config.DLNAPlaylistName, returnPlaylist: this.config.showingDLNA });
				return;
			case "ScrollLeft":
				//if the current item displayed is a server cant scroll left

				if (this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]].type == "server" || !this.DLNAServersLoaded) { return; }
				this.sendNotificationToNodeHelper("DLNA_ACTION", { action: action, currentServerID: this.currentServerID, item: this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]], returnPlaylist: this.config.showingDLNA });
				this.DLNACurrentIdx--;
				return;

			case "ScrollRight":
				//if current type is media, or no servers loaded yet, cant scroll right
				if (this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]].type == "media" || !this.DLNAServersLoaded) { return; }
				this.sendNotificationToNodeHelper("DLNA_ACTION", { action: action, currentServerID: this.currentServerID, item: this.DLNAItems[this.DLNAIdxs[this.DLNACurrentIdx]], returnPlaylist: this.config.showingDLNA });
				this.DLNACurrentIdx++;
				if (this.DLNACurrentIdx > this.DLNAIdxs.length-1) { this.DLNAIdxs[this.DLNACurrentIdx] = 0; }
				return;
		}

	},

	handleAction(action)
	{
		if (this.config.showEvents)
		{
			this.addLogEntry(`Handling: ${action}`);
		}

		//as some actions are triggered by actions on a button that we want to change, then map action to button name
		//some buttons may not loaded due to config; check them when attempting to set icon values

		var bAction = action;

		if (action == "volumechange") { bAction = "Volume"; } //volumechange is a special case as it is triggered by the audio element, not a button)

		const Icon = document.getElementById(bAction+"icon");

		switch (action) {

			case "ssNext":
				this.slideShow.next();
				return;

			case "ssPrev":
				this.slideShow.prev();
				return;

			case "ssStop":
				this.slideShow.stop();
				return;

			case "ssPlay":
				this.slideShow.play();
				return;

			case "ssPlay":
				this.slideShow.pause();
				return;

			case "MiniPlayer":
				this.showingMini = !this.showingMini;
				this.updateDom();
				this.startAudio();
				return;

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
				if (Icon)
				{
					if (this.audio.volume > 0 && this.audio.volume < 0.51) {
						Icon.className = "fas fa-volume-low";
					}
					else if (this.audio.volume > 0.5) {
						Icon.className = "fas fa-volume-high";
					}
					else {
						Icon.className = "fas fa-volume-off";
					}
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
				this.setAudioSrc(this.config.playlist[this.config.playlistOrder[this.currentTrack]]);
				//if not autoplay then make sure that the play control is showing the play icon and the track is teeded up ready to go
				if (!this.config.autoplay) {
					this.handleAction("Stop");
				}
				return;

			case "Next":
				this.currentTrack = (this.currentTrack + 1) % this.config.playlist.length;
				this.setAudioSrc(this.config.playlist[this.config.playlistOrder[this.currentTrack]]);
				//if not autoplay then make sure that the play control is showing the play icon and the track is teeded up ready to go
				if (!this.config.autoplay) {
					this.handleAction("Stop");
				}
				return;

			case "Play":
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

			case "DLNA":
				if (!this.config.showDLNA) { return; }
				this.config.showingDLNA = !this.config.showingDLNA;
				this.setupButton(action, this.iconMap[action][0], this.config.showingDLNA, null);
				//now tell node helper to toggle the DLNA playlist depending on the showingDLNA state
				this.requestTracks();
				return;
		}

	},

	showAlbumArt()
	{
		if (!this.config.art || !this.config.art[this.config.playlistOrder[this.currentTrack]]) { return; } //check we have actually got some art to load
		var sp = document.getElementById("eventLog");
		sp.setAttribute("art", this.config.art[this.config.playlistOrder[this.currentTrack]]);
		sp.style.backgroundImage = `url("${this.config.art[this.config.playlistOrder[this.currentTrack]]}")`;
		sp.style.backgroundSize = 'contain';
		sp.style.backgroundPosition = 'center';
		sp.style.backgroundRepeat = 'no-repeat';
	},
	
	showDLNAAlbumArt(url)
	{
		var sp = document.getElementById("eventLog");
		sp.setAttribute("art", url);
		sp.style.backgroundImage = `url("${url}")`;
		sp.style.backgroundSize = 'contain';
		sp.style.backgroundPosition = 'center';
		sp.style.backgroundRepeat = 'no-repeat';
	},

	requestServers()
	{

		this.sendNotificationToNodeHelper("GET_DLNA_SERVERS", null);

	},


	requestTracks() {

		if (!this.config.showingDLNA) {
			if (this.config.playTracks) {
				if (this.config.showEvents) { this.addLogEntry(`sending: SCAN_DIRECTORY`); }
				this.sendNotificationToNodeHelper("SCAN_DIRECTORY", this.config.musicDirectory);
			}
			else if (this.config.usePlaylist) {
				if (this.config.showEvents) { this.addLogEntry(`sending: LOAD_PLAYLIST`); }
				this.sendNotificationToNodeHelper("LOAD_PLAYLIST", [this.config.musicDirectory, this.config.playlistName]);
			}
			else {
				this.config.playlist = [];
				this.handleAction("Stop");
			}
		}
		else {
			if (this.config.showEvents) { this.addLogEntry(`sending: GET_DLNA_PLAYLIST`); }
			this.sendNotificationToNodeHelper("GET_DLNA_PLAYLIST", null);
		}
	},

	setBorder() {

		const controls = document.getElementById("controls");

		//replace the border class old,with new

		controls.classList.replace("still-border", !this.audio.paused ? "pulsing-border" : "still-border")
		controls.classList.replace("pulsing-border", !this.audio.paused ? "pulsing-border" : "still-border")
;
	},

	getTrackInfo() {

		if (!this.config.playlist || !this.config.playlist[this.currentTrack]) { return; }

		if (this.config.showMeta) {
			this.sendSocketNotification("GET_METADATA", this.config.playlist[this.config.playlistOrder[this.currentTrack]]);
		}
	},

	notificationReceived(notification) {
		//console.log(notification);
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
