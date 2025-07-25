const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
	start: function() {
		console.log("Music Player Node Helper started");
	},
	socketNotificationReceived(notification, payload) {

		if (notification === "SCAN_DIRECTORY") {

			const absolutePath = path.resolve(payload);

			//get the files for the web side of the module
			const files = fs.readdirSync(payload).filter(f => f.match(/\.(mp3|wav|ogg)$/i)).map(f => `${path.join(payload, f)}`);

			const paths = fs.readdirSync(payload).filter(f => f.match(/\.(mp3|wav|ogg)$/i)).map(f => `${path.join(absolutePath, f)}`);

			this.sendSocketNotification("PLAYLIST_READY", [files,paths]);
		}

		if (notification === "LOAD_PLAYLIST") {
			try {
				this.sendSocketNotification("PLAYLIST_READY", [this.getPlaylist(payload), this.getPlaylist(payload)]);
			} catch (err) {
				console.error("Error loading playlist:", err);
			}
		}

		if (notification === "GET_METADATA") {
			this.getMetaData(payload);
		}
	},

	getPlaylist: function (payload) {

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

	async getMetaData(payload)
	{
		/*
		* Reads metadata from a media file using music-metadata library.
		* @param {string} payload - The path to the media file.
		* if it is a local file uses parsefile
		* if it is a URL uses
		*/

		const missingMetaData = { title: "Unknown Title", artist: "Unknown Artist", album: "Unknown Album", track: "Unknown Track" };

		//import { createReadStream } from 'fs';

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
