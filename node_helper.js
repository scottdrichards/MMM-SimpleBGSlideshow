/* Magic Mirror
 * Module: MMM-SimpleBGSlideshow *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Based on/inspired by MMM-BackgroundSlideshow By Darick Carpenter
 * MIT Licensed.
 */

const express = require("express");
const Log = require("../../js/logger.js");
const NodeHelper = require("node_helper");
const FS = require("fs");
const pathModule = require("path");

module.exports = NodeHelper.create({
  start: function () {
    this.expressInstance = this.expressApp;
    this.watchedPaths = {}; // {path:{abortSignal, watcher, syncedEndpoints:state}}
  },

  socketNotificationReceived: function (notification, config) {
    Log.info(
      `Received notification: ${notification} from ${config.identifier}`
    );

    if (notification === "unsubscribe") {
      // TODO: unsubscribe from listeners
      return;
    }

    if (notification !== "subscribe")
      throw `No handler for notification: '${notification}'`;

    Log.info(
      `Handling request for images on paths: ${config.imagePaths.join(", ")}`
    );
    // Set up paths that are not currently monitored
    config.imagePaths
      .filter((path) => !(path in this.watchedPaths))
      .map((val, i, arr) => {
        if (i === arr.length - 1) Log.debug(`Adding ${arr.length} paths`);
        return val;
      })
      .forEach((path) => {
        Log.debug(`Adding path to watched paths: ${path}`);
        this.watchedPaths[path] = {
          timer: undefined, // This is used to debounce file change messages
          currentImages: new Set(),
          syncedEndpoints: {}
        };

        // Bind in express
        this.expressInstance.use(
          "/" + path,
          express.static(path, {
            maxAge: 60 * 60 * 1000 // one hour
          })
        );
        // Watch files and register them
        this.watchPath(path);
      });

    // Register the module as an interested party
    config.imagePaths
      .filter((path) => {
        // We only want paths that the module isn't already registered for
        return !this.watchedPaths[path].syncedEndpoints[config.identifier];
      })
      .forEach((path) => {
        Log.debug(
          `Adding endpoint ${config.identifier} to watchedPaths: ${path}`
        );
        // Add path to watch list
        this.watchedPaths[path].syncedEndpoints[config.identifier] = new Set();
        // Get the module up to speed
        if (this.watchedPaths[path].currentImages.size)
          this.sendUpdates(path, config.identifier);
      });
  },
  watchPath: function (path) {
    // Find current files
    Log.info(`Reading files in ${path}`);
    FS.readdir(path, (err, diskItems) => {
      if (err) return console.error(err.message);
      if (diskItems.length === 0) Log.debug(`No items in path ${path}`);
      diskItems.forEach((diskItem) => this.processFilePath(path, diskItem));
    });

    // Spin up a file watcher daemon
    try {
      Log.info(`Watching ${path}`);
      FS.watch(path, (eventType, filename) => {
        if (eventType === "rename") {
          // "rename" is used for add/delete/rename. A rename will actully
          // cause two calls, one for the old file name and one for the new

          // Now lets see if it is a file path we care about
          this.processFilePath(path, filename);
        }
      });
    } catch (err) {
      if (err.name === "AbortError") return;
      throw err;
    }
  },
  processFilePath: function (path, filename) {
    const filePath = pathModule.join(path, filename);
    FS.stat(filePath, (err, stats) => {
      if (err) {
        Log.error(err.message);
        this.watchedPaths[path]?.currentImages.delete(filename);
      } else if (stats.isDirectory()) {
        // not handling directories yet
      } else {
        Log.debug(`Adding ${filename} to current images`);
        this.watchedPaths[path].currentImages.add(filename);
      }
      clearTimeout(this.watchedPaths[path]?.timer);
      this.watchedPaths[path].timer = setTimeout(() => {
        this.sendUpdates(path);
      }, 500);
    });
  },
  sendUpdates: function (path, id = undefined) {
    // The watchedPaths[path] may have been removed since we set up this timer
    if (!this.watchedPaths[path]) return;
    Log.debug(`Preparing updates for path: ${path}`);

    (id ? [id] : Object.keys(this.watchedPaths[path].syncedEndpoints)).forEach(
      (id) => {
        const syncedImages = this.watchedPaths[path].syncedEndpoints[id];
        const imagesToAdd = [
          ...setSubtraction(this.watchedPaths[path].currentImages, syncedImages)
        ];
        const imagesToRemove = [
          ...setSubtraction(syncedImages, this.watchedPaths[path].currentImages)
        ];

        Log.info(
          `BGSS Sending update to ${id}: ${
            imagesToAdd.length ? `+ ${imagesToAdd.length} images` : ""
          } ${imagesToRemove.length ? `- ${imagesToRemove.length} images` : ""}`
        );
        this.sendSocketNotification(`IMAGE_PATH_UPDATE`, {
          identifier: id,
          path,
          imagesToAdd,
          imagesToRemove
        });

        this.watchedPaths[path].syncedEndpoints[id] = new Set(
          this.watchedPaths[path].currentImages
        );
      }
    );
  }
});

const setSubtraction = (setA, minusB) => {
  return new Set([...setA].filter((a) => !minusB.has(a)));
};
