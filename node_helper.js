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
				const data = fs.readFileSync(path.join(__dirname, payload), "utf-8");
				const playlist = JSON.parse(data);
				this.sendSocketNotification("PLAYLIST_READY", playlist);
			} catch (err) {
				console.error("Error loading playlist:", err);
			}
		}

		if (notification === "GET_METADATA") {
			this.getMetaData(payload);
		}
	},

	async getMetaData(payload)
	{
		(async () => {
			const { parseFile } = await import('music-metadata');
			try {
				const metadata = await parseFile(payload);
				const common = metadata.common || path.basename(filePath);
				this.sendSocketNotification("METADATA_RESULT", { common });
			} catch (error) {
				console.error('Error reading metadata:', error.message);
				this.sendSocketNotification("METADATA_RESULT", { common: { title: "Unknown Title", artist: "Unknown Artist", album: "Unknown Album", track: "Unknown Track" } });
			}
		})();
	},
});
