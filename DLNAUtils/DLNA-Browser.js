// Copyright 2016 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.
"use strict";
const http = require('http');
const url = require('url');
const xmlbuilder = require('xmlbuilder');
const xmltojs = require('xml2js');
const fs = require('node:fs');

// function to build the xml required for the saop request to the DLNA server
const buildRequestXml = function (id, options) {
	// fill in the defaults
	if (!options.browseFlag) {
		options.browseFlag = 'BrowseDirectChildren';
	}

	if (!options.filter) {
		options.filter = '*';
	}

	if (!options.startIndex) {
		options.startIndex = 0;
	}

	if (!options.requestCount) {
		options.requestCount = 1000;
	}

	if (!options.sort) {
		options.sort = '';
	}

	// build the required xml
	return xmlbuilder.create('s:Envelope', { version: '1.0', encoding: 'utf-8' })
		.att('s:encodingStyle', 'http://schemas.xmlsoap.org/soap/encoding/')
		.att('xmlns:s', 'http://schemas.xmlsoap.org/soap/envelope/')
		.ele('s:Body')
		.ele('u:Browse', { 'xmlns:u': 'urn:schemas-upnp-org:service:ContentDirectory:1' })
		.ele('ObjectID', id)
		.up().ele('BrowseFlag', options.browseFlag)
		.up().ele('Filter', options.filter)
		.up().ele('StartingIndex', options.startIndex)
		.up().ele('RequestedCount', options.requestCount)
		.up().ele('SortCriteria', options.sort)
		.doc().end({ pretty: true, indent: '  ' });
}

// function that allow you to browse a DLNA server
var browseServer = function (id, controlUrl, options, callback) {
	const requestUrl = url.parse(controlUrl);

	const httpOptions = {
		host: requestUrl.hostname,
		port: requestUrl.port,
		path: requestUrl.pathname,
		method: 'POST',
		headers: {
			'SOAPACTION': '"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"',
			'Content-Type': 'text/xml;charset=utf-8',
		}
	}

	const req = http.request(httpOptions, function (response) {
		var data = ''
		response.on('data', function (newData) {
			data = data + newData;
		});

		response.on('err', function (err) {
			console.log(callback(err));
		});

		response.on('end', function () {
			var browseResult = new Object;
			fs.appendFile("xmlRespnse.xml", data.replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&quot;", '"').replaceAll("&amp;", '&').replaceAll("&apos;", "'"), err => {
				if (err) {
					console.error(err);
				} else {
					// file written successfully
				}
			});
			xmltojs.parseString(data, function (err, result) {
				if (err) {
					// bailout on error
					callback(err);
					return;
				}

				// validate result included the expected entries
				if ((result['s:Envelope']) &&
					(result['s:Envelope']['s:Body']) &&
					(result['s:Envelope']['s:Body'][0]) &&
					(result['s:Envelope']['s:Body'][0]['u:BrowseResponse']) &&
					(result['s:Envelope']['s:Body'][0]['u:BrowseResponse'][0]) &&
					(result['s:Envelope']['s:Body'][0]['u:BrowseResponse'][0]['Result']) &&
					(result['s:Envelope']['s:Body'][0]['u:BrowseResponse'][0]['Result'][0])
				) {
					// this likely needs to be generalized to acount for the arrays. I don't have
					// a server that I've seen return more than one entry in the array, but I assume
					// the standard allows for that.  Will update when I have a server that I can
					// test that with
					xmltojs.parseString(result['s:Envelope']['s:Body'][0]['u:BrowseResponse'][0]['Result'][0], function (err, listResult) {
						if (err) {
							// bailout on error
							callback(err);
							return;
						}
						if (listResult['DIDL-Lite']) {
							const content = listResult['DIDL-Lite'];
							if (content.container) {
								browseResult.container = new Array();
								for (let i = 0; i < content.container.length; i++) {
									browseResult.container[i] = {
										'parentID': content.container[i].$.parentID,
										'id': content.container[i].$.id,
										'childCount': content.container[i].$.childCount,
										'searchable': content.container[i].$.searchable,
										'title': content.container[i]['dc:title'][0],
										'albumArt': content.container[i]['upnp:albumArtURI'] ? content.container[i]['upnp:albumArtURI'][0]['_'] ? content.container[i]['upnp:albumArtURI'][0]['_'] : null : null,
									}
								}
							}

							if (content.item) {
								browseResult.item = new Array();
								for (let i = 0; i < content.item.length; i++) {
									browseResult.item[i] = {
										'parentID': content.item[i].$.parentID,
										'id': content.item[i].$.id,
										'title': content.item[i]['dc:title'][0],
										'res': content.item[i].res[0]['_'],
										'contentType': content.item[i]['upnp:class'] ? content.item[i]['upnp:class'][0] ? content.item[i]['upnp:class'][0] : content.item[i].res[0].$.protocolInfo : content.item[i].res[0].$.protocolInfo,
										'albumArt': content.item[i]['upnp:albumArtURI'] ? content.item[i]['upnp:albumArtURI'][0]['_'] ? content.item[i]['upnp:albumArtURI'][0]['_'] : null : null,
										'genre': content.item[i]['upnp:genre'] ? content.item[i]['upnp:genre'][0] ? content.item[i]['upnp:genre'][0] : null : null,
										'artist': content.item[i]['upnp:artist'] ? content.item[i]['upnp:artist'][0] ? content.item[i]['upnp:artist'][0] : null : null,
										'album': content.item[i]['upnp:album'] ? content.item[i]['upnp:album'][0] ? content.item[i]['upnp:album'][0] : null : null,
										'date': content.item[i]['dc:date'] ? content.item[i]['dc:date'][0] ? content.item[i]['dc:date'][0] : null : null
									}
								}
							}
							callback(undefined, browseResult);
						} else {
							var msg = result;
							if (typeof result === 'object') { msg = JSON.stringify(result) };
							callback(new Error('Did not get expected listResult from server:' + msg));
							return;
						}
					});
				} else {
					var msg = result;
					if (typeof result === 'object') { msg = JSON.stringify(result) };
					callback(new Error('Did not get expected response from server:' + msg));
					return;
				}
			});
		});
	});
	req.on('error', function (err) {
		//req.close();
		callback(err);
	});
	var requestXml;
	try {
		requestXml = buildRequestXml(id, options);
	} catch (err) {
		// something must have been wrong with the options specified
		callback(err);
		return;
	}
	req.write(requestXml);
	req.end();
};

module.exports = browseServer;
