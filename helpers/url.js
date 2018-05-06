/**
 * Url constructor
 *
 * @module url
 * @license MIT
 */

/** Dependencies */
const config = require('../config');
const qs = require('querystring');

/**
 * Constructs file url for file path from Telegram
 * @param {Telegram:FilePath} filePath Path of the file
 * @return {URL} Url to download file
 */
function fileUrl(filePath) {
	return `https://api.telegram.org/file/bot${config.token}/${qs.escape(filePath)}`;
}

/** Exports */

module.exports = {
	fileUrl,
}