# MMM-SimplePlayer

This magic mirror module will enable the user to play music, control playback and view details of the Track playing. Tracks are either played from a local folder relative to the MagicMirror folder or from a named playlist in a local folder, containing locals tracks in folders relative to the MagicMirror Folder, or from any streaming servers.

### Examples:

Screenshots of the Simple layout when not playing, and when music is playing<br>
![Example of MMM-SimplePlayer audio player module](Screenshot_simple.png?raw=true "Screenshot of simple Controls not playing")<BR>
<BR>
![Video of MMM-SimplePlayer audio player module](g130129.gif)
<br>
Showing MetaData (Artist album track# and track title)
<br>
![Example of MMM-SimplePlayer audio player module](Screenshot_withMeta.png?raw=true "Screenshot with meta + Controls")<BR>
Showing Event Viewer (used for debugging), and meta data.
<br>
![Example of MMM-SimplePlayer audio player module](Screenshot_EventViewer.png?raw=true "Screenshot with meta + Controls")<BR>

## Tracks

###Formats

As this module uses the HTML5 Audio tag supported in most modern browsers and Electron (the native Magimirror GUI) then only tracks of these types are supported: MP3, OGG, WAV. 

If tracks are in different formats, such as WMA, then use a conversion tool to create MP3 versions. VLC is a great free player that will also convert tracks from various formats to MP3.

###Security and track location

Modern browsers incorporate various security features that wont load tracks from "unSafe" locations. Different browsers (inclduing Electron) have different interpretations of what is "unSafe" and so tracks in a location playable from one device/interface may be rejected in another combination. 

If the tracks are on the MagicMirror server, then store them in a folder that is relative to the Main MagicMirror folder (this is the location that MagicMirror is run from). The default location is in a music folder within the MMM-SimplePlayer folder within the modules folder of the MagicMirror implementation.

If using a playlist, then the tracks within the playlist shoudl either refer to the same or similar folder within the MagicMirror folder structure and/or be streamed from a web server. DLNA servers make a good source as they can be anywhere on your network. 

###Playlist formats

Playlists in the standard m3u or m3u8 format are supported. For local tracks make sure that the track is referenced in a relative way (i.e. it shouldnt start with \ or /) and that is is within or the folder or subfolder indicated by the folders in the musicDirectory config entry, see examples below.

If the tracks are from a webserver, then they should start with HTTP:// or HTTPS://

There are many tools available to build a standard playlist. Microsofts Legacy Media player (MMP) can easily add tracks from a DLNA server into a playlist, that can then be saved in m3u format.

###Example Playlist - from DLNA server, created using MMP

```
#EXTM3U
#EXTINF:0,34155.mp3?WMContentFeatures=DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_FLAGS=01700000000000000000000000000000&WMHME=1&WMDuration=4010000000&WMHMETitle=RABvAG4AJwB0ACAAVwBvAHIAcgB5AA==
http://199.169.9.99:50002/m/MP3/34155.mp3?WMContentFeatures=DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_FLAGS=01700000000000000000000000000000&WMHME=1&WMDuration=4010000000&WMHMETitle=RABvAG4AJwB0ACAAVwBvAHIAcgB5AA==

#EXTINF:0,34282.mp3?WMContentFeatures=DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_FLAGS=01700000000000000000000000000000&WMHME=1&WMDuration=2460000000&WMHMETitle=QgBlAGEAdAAgADUANAAgACgAQQBsAGwAIABHAG8AbwBkACAATgBvAHcAKQA=
http://199.169.9.99:50002/m/MP3/34282.mp3?WMContentFeatures=DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_FLAGS=01700000000000000000000000000000&WMHME=1&WMDuration=2460000000&WMHMETitle=QgBlAGEAdAAgADUANAAgACgAQQBsAGwAIABHAG8AbwBkACAATgBvAHcAKQA=
```

###Example Playlist - using local files

```
#EXTM3U
#EXTINF:0
track1.mp3
#EXTINF:0
track2.mp3
#EXTINF:0
track3.mp3
```

Note that these tracks are in the folder indicated in the musicDirectory config value

##Module Installation and config options

## Dependencies

This module requires music-metadata if meta data is to be displayed.

## Installation
To install the module, use your terminal to:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/TheBodger/MMM-SimplePlayer`
3. CD to the folder:<br />`CD MMM-SimplePlayer`
4. Install dependencies:<br />`npm install`

## Update
to update this module, use your terminal to:
1. `cd ~/MagicMirror/modules/MMM-SimplePlayer`
2. `git pull`

## Using the module

### MagicMirror² Configuration

To use this module, add the following minimum configuration block to the END of the modules array in the `config/config.js` file:
```js
		{
			module: "MMM-SimplePlayer",
			position: "top_left",
		},
```
This will show the Simple format of controls (as in example 1 above) which will play any valid tracks from the folder MMM-SimplePlayer/music

###Example Config

```
{
	module: "MMM-SimplePlayer",
	position: "top_left",
	config: {
		autoplay: true, 
		playTracks: false, //Means eithe play from the directory or not, must be false to use the playlist
		musicDirectory: "modules/MMM-SimplePlayer/music",
		usePlaylist: true,
		playlistName: "examplePlaylist.m3u",
		showEvents: false,
		showMeta: true,
		startMuted: false,
	}
},
```





