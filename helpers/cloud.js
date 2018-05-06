/**
 * Manages google cloud storage
 *
 * @module cloud
 * @license MIT
 */

/** Dependencies */
const path = require('path');
const Storage = require('@google-cloud/storage');
const config = require('../config');

const storage = new Storage({
  projectId: config.g_cloud_project_id,
  credentials: require('../certificates/voicy.json'),
});

function put(path) {
  return new Promise((resolve, reject) => {
    const bucket = storage.bucket(config.g_cloud_project_id);
    bucket.upload(path, (err, file) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`gs://${config.g_cloud_project_id}/${file.name}`);
    });
  });
}

function del(uri) {
  return new Promise((resolve, reject) => {
    const bucket = storage.bucket(config.g_cloud_project_id);
    const file = bucket.file(path.basename(uri));
    file.delete((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/** Exports */
module.exports = {
  put,
  del,
};
