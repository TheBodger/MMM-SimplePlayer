const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
	start: function() {
		console.log("Music Player Node Helper started");
	},
	socketNotificationReceived(notification, payload) {
		if (notification === "SCAN_DIRECTORY") {
			const files = fs.readdirSync(payload)
				.filter(f => f.match(/\.(mp3|wav|ogg)$/i))
				.map(f => `${path.join(payload, f)}`);
			this.sendSocketNotification("PLAYLIST_READY", files);
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
	}
});
