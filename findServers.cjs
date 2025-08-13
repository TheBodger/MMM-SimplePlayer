'use strict';

const http = require('http');
const https = require('https');
const { parse } = require('url');
const { StringDecoder } = require('string_decoder');
const { DOMParser } = require('xmldom'); // Optional if you allow small non-network dependency
const { Client } = require('node-ssdp-js');
//const browseServer = require('dlna-browser-utils');
const browseServer = require('./DLNAUtils/DLNA-Browser.js');

//const { } = require();

const client = new Client();

class TreeNode {
  constructor(id, name, art, URL, contentType, content, parentId) {
    this.id = id;
    this.parentId = parentId;
    this.name = name;
    this.art = art;
    this.url = URL;
    this.contentType = contentType;
    this.content = content
    this.children = [];
  }
}
class Media {
  constructor(artist, genre, album, albumArt, date) {
    this.artist = artist;
    this.genre = genre;
    this.album = album;
    this.albumArt = albumArt;
    this.date = date;
  }
}
class FolderTree {
  constructor() {
    this.nodes = new Map(); // Map of id -> TreeNode
    this.rootIds = new Set(); // Optional: to track top-level folders
  }

  addNodeIfMissing(id, name, art, URL, contentType, content,parentId) {
    if (!this.nodes.has(id)) {
      const newNode = new TreeNode(id, name, art, URL, contentType, content, parentId);
      this.nodes.set(id, newNode);
      this.rootIds.add(id);
    }
    return this.nodes.get(id);
  }

  addChild(parentId, childId, childName, childArt, childURL, childcontentType, childcontent) {
    const parentNode = this.addNodeIfMissing(parentId, `Folder ${parentId}`, null, null, null, null, null);
    let childNode = this.nodes.get(childId);

    if (!childNode) {
      childNode = new TreeNode(childId, childName, childArt, childURL, childcontentType, childcontent, parentId);
      this.nodes.set(childId, childNode);
    }

    const alreadyChild = parentNode.children.find(c => c.id === childId);
    if (!alreadyChild) {
      parentNode.children.push(childNode);
      this.rootIds.delete(childId); // Child should no longer be a root
    }
  }

  getTree() {
    return [...this.rootIds].map(id => this.nodes.get(id));
  }

  buildTree(node) {
    return {
      parentId: node.parentId,
      id: node.id,
      name: node.name,
      art: node.art,
      url: node.url,
      contentType: node.contentType,
      content: JSON.stringify(node.content),
      children: node.children.map(child => this.buildTree(child))
    };
  }

  getTreeJSON() {
    return [...this.rootIds].map(id => this.buildTree(this.nodes.get(id)));
  }

}

var globalCallback = null;
var searchNodes = [];

function allValuesTrue(data) {
  return data.every(obj =>
    Object.values(obj).every(value => value === true)
  );
}
function getNodeChildren(server, node, recurse, resetSearchNodes, onCompleteCallback) {

  if (resetSearchNodes) { searchNodes = []; }

  searchNodes.push({ [node.id]: false });

  const controlURL = getControlDetails(server);

  const weRecurse = recurse;
  const parentID = node.id;
  const thisServer = server;

  listFolderContents(node.id, "GetFolder", controlURL.href, (err, subcontent) => {
    var x = 9;
    if (err) {
      console.error('Error listing content:', err, subcontent);
      onCompleteCallback(err)
    }
    else {
      //add the folders to the servers folder tree

      subcontent.folders.forEach(folder => {

        thisServer.folderTree.addChild(parentID, folder.id, folder.title, folder.albumArt ? folder.albumArt : null, null, folder.contentType, { albumArt: folder.albumArt ? folder.albumArt : null });

      });

      subcontent.musicFiles.forEach(music => {

        thisServer.folderTree.addChild(parentID, music.id, music.title, music.albumArt, music.url, music.contentType, new Media(music.artist, music.genre, music.album, music.albumArt, music.date));

      });
      subcontent.photoFiles.forEach(photo => {

        thisServer.folderTree.folderTree.addChild(parentID, photo.id, photo.title, photo.albumArt, photo.url, photo.contentType, new Media(null, null, photo.album, null, video.date));

      });
      subcontent.videoFiles.forEach(video => {

        thisServer.folderTree.addChild(parentID, video.id, video.title, video.albumArt, video.url, video.contentType, new Media(null, null, null, null, video.date));

      });
      subcontent.otherFiles.forEach(other => {

        thisServer.folderTree.addChild(parentID, other.id, other.title, other.albumArt, other.url, other.contentType, null);

      });

      searchNodes.forEach(entry => { //set the searched node to true
        if (entry.hasOwnProperty(parentID)) {
          entry[parentID] = true;
        }
      });

      if (weRecurse && subcontent.folders.length > 0) {
        subcontent.folders.forEach(folder => {
          const node = { id: folder.id };
          getNodeChildren(server, node, recurse, false, onCompleteCallback)
        });
      }

      onCompleteCallback(null,searchNodes)
    }

  });
}

function findServers(callback) {
    globalCallback = callback
    client.browse('urn:schemas-upnp-org:service:ContentDirectory:1');
}

function stopFindingServers() {
    if (client) {
        client.stop();
        console.log('Stopped finding servers.');
    }
}

client.on('response', (response) => {
    var headers = response.headers;
    var statusCode = response.statusCode;
    var referrer = response.referrer;
    console.log('DLNA Server Found:', headers.LOCATION);
    getServerDetails(headers.LOCATION, globalCallback);
});

function getServerDetails(locationUrl, callback) {
    const hostDetails = new URL(locationUrl);
    fetchXML(locationUrl, (err, xml) => {
        if (err) return callback(err);

        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');

        const getText = tag => {
            const el = doc.getElementsByTagName(tag)[0];
            return el ? el.textContent.trim() : null;
        };

        const services = [];
        const serviceElements = doc.getElementsByTagName('service');

        for (let i = 0; i < serviceElements.length; i++) {
            const service = serviceElements[i];
            const type = service.getElementsByTagName('serviceType')[0]?.textContent.trim();
            const control = service.getElementsByTagName('controlURL')[0]?.textContent.trim();
            const SCPDURL = service.getElementsByTagName('SCPDURL')[0]?.textContent.trim();
            if (type && control) {
                services.push({ serviceType: type, controlURL: control, SCPDURL: SCPDURL });
            }
        }

        const details = {
            friendlyName: getText('friendlyName'),
            manufacturer: getText('manufacturer'),
            modelName: getText('modelName'),
            //icons: doc.getElementsByTagName('iconlist'),
            services
        };

        callback(null, { details, hostDetails });
    });
}
function fetchXML(locationUrl, callback) {
    const urlParts = parse(locationUrl);
    const protocol = urlParts.protocol === 'https:' ? https : http;

    const req = protocol.get(locationUrl, res => {
        const decoder = new StringDecoder('utf8');
        let data = '';

        res.on('data', chunk => { data += decoder.write(chunk); });
        res.on('end', () => {
            data += decoder.end();
            callback(null, data);
        });
    });

    req.on('error', err => callback(err));
}

function getControlDetails(server) {

  const hostDetails = server.properties.hostDetails;
  const controlURL = new URL('https://nodejs.org/');
  controlURL.host = hostDetails.host;
  controlURL.protocol = hostDetails.protocol;

  server.properties.details.services.forEach(service => {

    if (service.serviceType === 'urn:schemas-upnp-org:service:ContentDirectory:1') {

      controlURL.pathname = service.controlURL;
    }

  });

  return controlURL;
}


//// Simulated async function to populate a node's children
async function populateNodeAsync(node,server) {
  // Replace this with actual logic, e.g., database call or API request

	return await fetchChildrenFor(node,server);
}

// Recursive async function to count media items
async function loadMediaItemsAsync(node, server) {
	if (!node) return 0;

	// Populate children if not already present
	if (!node.children || node.children.length ==0) {
		node.children = await populateNodeAsync(node,server);
	}

	//let count = node.type === 'media' ? 1 : 0;

	// Recursively load media items in children
	for (const child of node.children) {
    var res = await loadMediaItemsAsync(child,server);
	}

  return node.children;
}

async function fetchChildrenFor(node,server) {

  //here we actually find any children for the passed node, returning them as a children list

  const tree = new FolderTree();

  const controlURL = getControlDetails(server);
  return new Promise((resolve) => {
    listFolderContents(node.id, "GetFolder", controlURL.href, (err, subcontent) => {
      if (err) {
        console.error('Error listing content:', err, subcontent);
      }
      else {
        //add the folders to the servers folder tree

        subcontent.folders.forEach(folder => {
          tree.addChild(node.id, folder.id, folder.title, folder.albumArt ? folder.albumArt : null, null, folder.contentType, null);
        });
        subcontent.musicFiles.forEach(music => { });
        subcontent.photoFiles.forEach(photo => { });
        subcontent.otherFiles.forEach(other => { });
        subcontent.otherFiles.forEach(other => { });
      }
      return tree.nodes;
    });
  });
}

function getChildren(server, parentID, callback) {
  const controlURL = getControlDetails(server);
  //const parentID = parentID;
  listFolderContents(parentID, "GetFolder", controlURL.href, (err, subcontent) => {
    if (err) {
      console.error('Error listing content:', err, subcontent);
    }
    else {
      //add the folders to the servers folder tree

      subcontent.folders.forEach(folder => {

        server.folderTree.addChild(parentID, folder.id, folder.title, folder.albumArt ? folder.albumArt : null, null, folder.contentType, null);

      });

      subcontent.musicFiles.forEach(music => {

        server.folderTree.addChild(parentID, music.id, music.title, music.albumArt, music.url, music.contentType, new Media(music.artist, music.genre, music.album, music.date));

      });
      subcontent.photoFiles.forEach(photo => {

        server.folderTree.addChild(parentID, photo.id, photo.title, photo.albumArt, photo.url, photo.contentType, new Media(null, null, photo.album, video.date));

      });
      subcontent.videoFiles.forEach(video => {

        server.folderTree.addChild(parentID, video.id, video.title, video.albumArt, video.url, video.contentType, new Media(null, null, null, video.date));

      });
      subcontent.otherFiles.forEach(other => {

        server.folderTree.addChild(parentID, other.id, other.title, other.albumArt, other.url, other.contentType, null);

      });
    }

    //console.dir(server.folderTree.getTreeJSON(), { depth: null });

    callback(err, parentID, server);

  });
}

function listFolderContents(folderId, ftitle, controlUrl, callback) {
  console.log(`Listing contents of folder: ${folderId} (${ftitle}) at ${controlUrl}`);
  if (folderId < 0) { folderId = "0"; }
  browseServer(folderId, controlUrl, {}, (err, result) => {
    if (err) return callback(err, folderId);

    var musicFiles = [];
    var videoFiles = [];
    var photoFiles = [];
    var folders = [];
    var otherFiles = [];

    if (result.container) {
      folders = result.container.map(c => ({
        parentId:folderId,
        id: c.id,
        title: c.title,
        childCount: c.childCount,
        albumArt: c.albumArt,
        parentID: c.parentID,
        contentType: null,
      }));
    }

    if (result.item) {

      musicFiles = result.item
        .filter(i => i.contentType.includes('audio'))
        .map(i => ({
          title: i.title,
          url: i.res,
          albumArt: i.albumArt,
          parentID: folderId,
          id: i.id,
          contentType: "media",//i.contentType,
          genre: i.genre,
          album: i.album,
          artist: i.artist,
          date: i.date,
        }));

      videoFiles = result.item
        .filter(i => i.contentType.includes('video'))
        .map(i => ({
          title: i.title,
          url: i.res,
          albumArt: i.albumArt,
          parentID: folderId,
          id: i.id,
          contentType: "media",//i.contentType,
          date: i.date,
        }));

      photoFiles = result.item
        .filter(i => i.contentType.includes('image'))
        .map(i => ({
          title: i.title,
          url: i.res,
          albumArt: i.albumArt,
          parentID: folderId,
          id: i.id,
          contentType: "media",// i.contentType,
          album: i.album,
          date: i.date,
        }));

      otherFiles = result.item
        .filter(i => !i.contentType.includes('audio'))
        .filter(i => !i.contentType.includes('video'))
        .filter(i => !i.contentType.includes('image'))
        .map(i => ({
          title: i.title,
          url: i.res,
          albumArt: i.albumArt,
          parentID: folderId,
          id: i.id,
          contentType: i.contentType,
        }));
    }
    callback(null, { title: ftitle, folders, musicFiles, videoFiles, photoFiles, otherFiles });
  });
}

module.exports = { findServers, stopFindingServers, FolderTree, Media, getControlDetails, getChildren, listFolderContents, getNodeChildren, allValuesTrue };
