'use strict';

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

const { setDebug, findServers, stopFindingServers, FolderTree, getNodeChildren, allValuesTrue, Media } = require('./findServers.cjs');

var self = null;

//the playlist returned to the main modele will be determined by the use of DLNA and if the DLNA source is selected in the module - this.config.DLNAplaying

module.exports = NodeHelper.create({

	start: function ()
	{
		console.log("Music Player Node Helper started");
		this.setInitialValues();
	},

	setInitialValues()
	{
		this.servers = []; //must be unique
		this.serverId = -1;
		this.DLNAtrackPaths = []; // the actual DLNA playlist that is sent back to the module to play, can be added/subtracted, cleared, saved and loaded into
		this.DLNAtrackArt = []; //dlna art for each matching track above

		this.currentNodeID = null;
		this.currentServer = null;
		this.currentServerIdx = null;

		this.DLNAShowing = false;
	},

	socketNotificationReceived(notification, payload)
	{
		if (payload && payload.returnPlaylist) { this.DLNAShowing = payload.returnPlaylist };

		if (notification === "CONFIG") {
			this.config = {};
			this.config.debug = payload.config.debug;
			setDebug(this.config.debug);
		}

		if (notification === "SCAN_DIRECTORY") {

			const absolutePath = path.resolve(payload);

			//get the files for the web side of the module
			const files = fs.readdirSync(payload).filter(f => f.match(/\.(mp3|wav|ogg)$/i)).map(f => `${path.join(payload, f)}`);

			const paths = fs.readdirSync(payload).filter(f => f.match(/\.(mp3|wav|ogg)$/i)).map(f => `${path.join(absolutePath, f)}`);

			this.sendSocketNotification("PLAYLIST_READY", [files, paths,null]);
		}

		if (notification === "LOAD_PLAYLIST") {
			try {
				this.sendSocketNotification("PLAYLIST_READY", [this.getPlaylist(payload), this.getPlaylist(payload), null]);
			} catch (err) {
				console.error("Error loading playlist:", err);
			}
		}

		if (notification === "GET_DLNA_SERVERS") {

			//regardless of when this is called, need to reset some value to defaults

			this.setInitialValues();

			this.getDLNAServers();

			//wait for 10 seconds and then stop finding servers
			setTimeout(() => {
				console.log('Stopping server discovery...');

				stopFindingServers();

			}, 10000);
		}

		if (notification === "DLNA_ACTION")
		{
			//determined by actionm handle the passed payload
			switch (payload.action) {
				case "ScrollDown":
					return;

				case "ScrollUp":
					return;


				case "Add":

					return;
				case "Remove":

					return;
				case "Clear":

					return;
				case "Save":

					return;
				case "Open":

					return;
				case "ScrollLeft":

					//should be able to return details at the same level as the parentid of the passed item

					//console.log("left", payload.currentServerID);

					this.getDLNAItems(payload.action, payload.item, payload.currentServerID);

					return;

				case "ScrollRight":
					//if the item passed is a server check for 0 (id of a server is 0)
					//otherwise check for children and if present return them and if not present search and return

					//console.log("right", payload.currentServerID);
					this.getDLNAItems(payload.action, payload.item, payload.currentServerID);

					return;
			}

		}

		if (notification === "GET_METADATA")
		{
			this.getMetaData(payload);
		}

		if (notification === "CLEAR_DLNA_PLAYLIST") {
			//clear local playlist
			this.DLNAtrackPaths = [];
			this.DLNAtrackArt = [];
			if (this.DLNAShowing) { this.sendSocketNotification("PLAYLIST_READY", [this.DLNAtrackPaths, this.DLNAtrackPaths, this.DLNAtrackArt]) }

			//reload the servers, server id here shold always be -1
			this.setInitialValues();
			this.getDLNAServers();
			//wait for 10 seconds and then stop finding servers
			setTimeout(() => {
				console.log('Stopping server discovery...');

				stopFindingServers();

			}, 10000);

		}

		if (notification === "GET_DLNA_PLAYLIST") //send back the current playlist
		{
			this.sendSocketNotification("PLAYLIST_READY", [this.DLNAtrackPaths, this.DLNAtrackPaths, this.DLNAtrackArt]);
		}

		if (notification === "SAVE_DLNA_PLAYLIST") //save the current playlist
		{
			var DLNAPlaylistPath = path.join(payload.musicDirectory, payload.DLNAPlaylistName);
			this.buildM3U(DLNAPlaylistPath, this.DLNAtrackPaths, this.DLNAtrackArt);
		}

		if (notification === "OPEN_DLNA_PLAYLIST") //save the current playlist
		{
			var DLNAPlaylistPath = path.join(payload.musicDirectory, payload.DLNAPlaylistName);
			[ this.DLNAtrackPaths, this.DLNAtrackArt ] = this.getDLNAPlaylist(DLNAPlaylistPath);
			if (payload.returnPlaylist) { this.sendSocketNotification("PLAYLIST_READY", [this.DLNAtrackPaths, this.DLNAtrackPaths, this.DLNAtrackArt]) };
		}

		if (notification === "ADD_DLNA_ITEM")
		{
			//handle the add action: use the passed item to find this and all children nodes, searching for new ones if needed to get all the media and add to the DLNA playlist
			//before passing it to the module for playing

			this.currentServerIdx = this.findItemIndexById(this.servers, payload.currentServerID);

			this.loadDLNAitems(this.currentServerIdx, payload.item.id , true, this.loadPlaylistCallback);
		}
		if (notification === "REMOVE_DLNA_ITEM") {
			//handle the remove action: use the passed item to find this and all children nodes, searching for new ones if needed to get all the media and remove from the DLNA playlist
			//before passing it to the module for playing

			this.currentServerIdx = this.findItemIndexById(this.servers, payload.currentServerID);

			this.loadDLNAitems(this.currentServerIdx, payload.item.id, true, this.removePlaylistCallback);
		}
		
	},

	loadPlaylistCallback :function (err, searchNodes)
	{

		if (err)
		{
			console.error('Err:', err)
			return;
		}

		if (allValuesTrue(searchNodes))
		{
			//getall the media from this and all child nodes, more recursion
			//getall the media from this and all child nodes, more recursion

			var parentNode = self.currentServer.folderTree.nodes.get(self.currentNodeID);

			self.addMediaToTracks(parentNode);

			if (self.DLNAShowing) {
				try {
					self.sendSocketNotification("PLAYLIST_READY", [self.DLNAtrackPaths, self.DLNAtrackPaths, self.DLNAtrackArt]);
				} catch (err) {
					console.error("Error loading playlist:", err);
				}
			}

		}

	},

	addMediaToTracks: function (parentNode)
	{
		parentNode.children.forEach(child => {
			if (!(child.contentType == "media")) {
				self.addMediaToTracks(child)
			}
			else {
				self.DLNAtrackPaths.push(child.url);
				self.DLNAtrackArt.push(child.art);
			}
		});
	},

	removePlaylistCallback: function (err, searchNodes) {

		if (err) {
			console.error('Err:', err)
			return;
		}

		if (allValuesTrue(searchNodes)) {
			//getall the media from this and all child nodes, more recursion

			var parentNode = self.currentServer.folderTree.nodes.get(self.currentNodeID);

			self.removeMediaFromTracks(parentNode);

			if (self.DLNAShowing) {
				try {
					self.sendSocketNotification("PLAYLIST_READY", [self.DLNAtrackPaths, self.DLNAtrackPaths, self.DLNAtrackArt]);
				} catch (err) {
					console.error("Error loading playlist:", err);
				}
			}

		}

	},

	removeMediaFromTracks: function (parentNode) {
		parentNode.children.forEach(child => {
			if (!(child.contentType == "media")) {
				self.addMediaToTracks(child)
			}
			else {

				var index = self.DLNAtrackPaths.indexOf(child.url);

				if (index !== -1) {
					self.DLNAtrackPaths.splice(index, 1);
					self.DLNAtrackArt.splice(index, 1);
				}

			}
		});
	},

	onCompleteCallback: function (err, searchNodes) {
	//searching for node has finished time to check if all nodes completed searching 

		if (err) {
			console.error('Err:', err)
			return;
		}

		if (allValuesTrue(searchNodes)) {

			//if we are here then all the searches should be completed and we can process them as we wish

			var node = self.currentServer.folderTree.nodes.get(self.currentNodeID);

			if (node.children.length == 0) {
				//empty node
				//add an empty child entry
				self.currentServer.folderTree.addChild(node.id, "empty", "Empty Folder", null, null, "media", new Media(null, null, null, null, null));

			}

			self.sendSocketNotification("NEW_DLNA_ITEMS", self.populateDLNAList_children(node));

		}

	},

	loadDLNAitems: function (serverIDX, id, recurse = false, callback = '') {

		this.currentServer = this.servers[serverIDX];
		this.currentNodeID = id;

		var searchNode = { id: this.currentNodeID };
		var resetSearchNodes = true;

		var currentNode = this.servers[serverIDX].folderTree.nodes.get(this.currentNodeID);

		if (currentNode.contentType == "media") //just load the media, dont try and get any children // if here we must be in an add situation
		{

			this.addNodeMedia(currentNode);

			if (self.DLNAShowing) {
				try {
					self.sendSocketNotification("PLAYLIST_READY", [self.DLNAtrackPaths, self.DLNAtrackPaths, self.DLNAtrackArt]);
				} catch (err) {
					console.error("Error loading playlist:", err);
				}
			}
		}
		else {
			if (callback == '') { callback = this.onCompleteCallback; }

			self = this;

			getNodeChildren(this.currentServer, searchNode, recurse, resetSearchNodes, callback)
		}
	},

	addNodeMedia(node) {

		self.DLNAtrackPaths.push(node.url);
		self.DLNAtrackArt.push(node.art);

	},

	getDLNAItems(action, item, serverID)
	{
		var DLNAList = [];

		//if action is right, find the node with the id -
		//if it has children return them
		//if there are no children, try and get some using its controlID (server = 0) as long as it isnt an item

		var result = this.getSearchNodeId(item, serverID);

		//if action is left, then find the node with the parentid and then its parent of the current node and populate children

		if (action.toLowerCase() == "scrollleft") {

			//get parent

			result = this.getSearchNodeId({ id: result.node.parentId, type: null }, serverID); //first parent

			result = this.getSearchNodeId({ id: result.node.parentId, type: null }, serverID); //first parent

			DLNAList = this.populateDLNAList_children(result.node); // populate with the actual node
		}

		if (action.toLowerCase() == "scrollright") {
			DLNAList = this.populateDLNAList_children(result.node); // populate with this nodes children
		}

		if (result.node && result.node.children.length>0) {

			this.sendSocketNotification("NEW_DLNA_ITEMS", DLNAList);

			return;

		}

		//if node is missing need to add it
		//searchid will be the current nodes id, i.e. the parent to any children to be found

		this.currentServerIdx = this.findItemIndexById(this.servers, serverID);

		this.loadDLNAitems(this.currentServerIdx,result.node.id);

	},

	findItemIndexById: function (list, searchId)
	{
		return list.findIndex(item => item.id === searchId);
	},


	getSearchNodeId: function (item, serverID) {

		//determine the server instance

		var server = this.servers.find(server => server.id === serverID);

		//now find the item ID - but it may not be present yet

		var searchID = item.id;
		var node = null;

		//if (item.type == "server") searchID = "0";

		if (server.folderTree.nodes.size > 0) {
			node = server.folderTree.nodes.get(searchID);
		}

		return {server: server, node: node, searchID: searchID};

	},

	populateDLNAList_children: function (node)
	{
		var DLNAList = [];

		node.children.forEach(child => {

			const newItem = { id: null, type: null, name: null, content: null }; //format of item to store in the list of items ready to return to the calling module

			newItem.id = child.id;
			newItem.type = child.contentType;
			newItem.name = child.friendlyName ? child.friendlyName : child.name; //if a server use friendly name otherwise use the name
			newItem.content = child.content;
			DLNAList.push(newItem);

		})

		return DLNAList;

	},

	getDLNAServers: function ()
	{
		//get any servers and send them back as part of a list that will be added to as new servers are found

		var DLNAList = [];

		findServers((err, result) => {
			if (err) console.error(err);
			else {

				const newServer = { id: this.serverId, server: result.details.friendlyName, properties: result, folderTree: new FolderTree() };
			
				if (!this.servers.some(server => server.server === newServer.server)) {
					newServer.folderTree.addChild(-99, this.serverId, newServer.server, null, null, "server",null);
					this.servers.push(newServer);
					this.serverId--;
				}

				if (!DLNAList.some(server => server.name === newServer.server)) {
					const newItem = { id: null, type: null, name: null }; //format of item to store in the list of items ready to return to the calling module
					newItem.id = newServer.id;
					newItem.type = "server";
					newItem.name = newServer.server;
					DLNAList.push(newItem);
				}

				this.sendSocketNotification("NEW_DLNA_ITEMS", DLNAList);
			}
		});

	},

	getPlaylist: function (payload)
	{

		/*
		 * Reads M3U/M3U8 playlist files in a directory and extracts all track paths into an array.
		 * @param {string} dir - The directory to search for playlist files.
		 * @returns {string[]} - Array of track paths.
		 */

		const trackPaths = [];

		// Find .m3u and .m3u8 files
		const playlistFiles = fs.readdirSync(payload[0]).filter(file =>
			file.endsWith('.m3u') || file.endsWith('.m3u8')
		);

		// Parse each playlist
		playlistFiles.forEach(file => {
			if (payload[1] == file) {
				const fullPath = path.join(payload[0], file);
				const content = fs.readFileSync(fullPath, 'utf-8');
				const lines = content.split(/\r?\n/);

				lines.forEach(line => {
					const trimmed = line.trim();
					// Ignore comments and empty lines
					if (trimmed && !trimmed.startsWith('#')) {
						//if starts with http or https, keep it as is
						if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {

							trackPaths.push(trimmed);
						}
						else {
							// Otherwise, join the music path relative to the playlist file
							const resolvedPath = path.join(payload[0], trimmed);
							trackPaths.push(resolvedPath);

						}
					}
				});
			}
		});

		return trackPaths;
		
	},

	getDLNAPlaylist: function (file) {

		/*
		 * Reads M3U/M3U8 playlist files in a directory and extracts all track paths into an array.
		 * @param {string} dir - The directory to search for playlist files.
		 * @returns {string[]} - Array of track paths.
		 */

		const trackPaths = [];
		const trackArt = [];

		/*
		#EXTM3U
		#EXTINF:0,http://192.168.1.39:50002/transcoder/jpegtnscaler.cgi/ebdart/33859.jpg
		http://192.168.1.39:50002/m/MP3/33859.mp3
		*/

		const content = fs.readFileSync(file, 'utf-8');
		const lines = content.split(/\r?\n/);

		lines.forEach(line => {
			const trimmed = line.trim();
			// empty lines
			if (trimmed && !trimmed.startsWith('#EXTM3U')) {
				if (trimmed.startsWith('#EXTINF')) //assume we have an album art entry 
				{
					var albumArtURL = trimmed.split(",")[1];
					trackArt.push(albumArtURL);
				}
				//if starts with http or https, keep it as is
				else if (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
				{
					trackPaths.push(trimmed);
				}
				else
				{
					// Otherwise, join the music path relative to the playlist file
					const resolvedPath = path.join(payload[0], trimmed);
					trackPaths.push(resolvedPath);
				}
			}
		});


		return [ trackPaths, trackArt ];

	},

	buildM3U(filePath, tracks, comments)
	{
		/*
		#EXTM3U
		#EXTINF:0,01 Piano Concerto No. 2, Second Movement.mp3
		/home/pi/Music/Various Classical Artists/Classic Fm Hall of Fame- The Silver Edition [Disc 1]/01 Piano Concerto No. 2, Second Movement.mp3
		*/

		var playlistEntries = "#EXTM3U\n";

		//iterate through the tracks with an index that is used to access the corresponding entry in comments

		for (let i = 0; i < tracks.length; i++) {
			playlistEntries += `#EXTINF:0,${comments[i]}\n`
			playlistEntries += `${tracks[i]}\n`
		}

		fs.writeFileSync(filePath, playlistEntries);
	},

	async getMetaData(payload)
	{
		/*
		* Reads metadata from a media file using music-metadata library.
		* @param {string} payload - The path to the media file.
		* if it is a local file uses parsefile
		* if it is a URL uses music-metadata
		*/
		//console.log(payload);

		const missingMetaData = { title: "Unknown Title", artist: "Unknown Artist", album: "Unknown Album", track: "Unknown Track" };

		if (!payload) { return; }

		if (payload.toLowerCase().startsWith('http')) {

			(async () => {
				const { parseWebStream } = await import('music-metadata');
				try {
					// Fetch the audio file
					const response = await fetch(payload);

					// Extract the Content-Length header and convert it to a number
					const contentLength = response.headers.get('Content-Length');
					const size = contentLength ? parseInt(contentLength, 10) : undefined;

					// Parse the metadata from the web stream
					const metadata = await parseWebStream(response.body, {
						mimeType: response.headers.get('Content-Type'),
						size // Important to pass the content-length
					});
					const common = metadata.common || missingMetaData;
					this.sendSocketNotification("METADATA_RESULT", { common });
				} catch (error) {
					console.error('Error parsing metadata:', error.message);
					this.sendSocketNotification("METADATA_RESULT", { common: missingMetaData });
				}
			})();
		}
		else {
			(async () => {
				const { parseFile } = await import('music-metadata');
				try {
					const metadata = await parseFile(payload);
					const common = metadata.common || missingMetaData;
					this.sendSocketNotification("METADATA_RESULT", { common });
				} catch (error) {
					console.error('Error reading metadata:', error.message);
					this.sendSocketNotification("METADATA_RESULT", { common: missingMetaData });
				}
			})();
		}
	},
});
