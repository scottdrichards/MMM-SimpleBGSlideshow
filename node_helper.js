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
    Log.info(notification);

    if (notification === "unsubscribe") {
      // TODO: unsubscribe from listeners
      return;
    }

    if (notification !== "subscribe")
      throw `No handler for notification: '${notification}'`;

    // Set up paths that are not currently monitored
    config.imagePaths
      .filter((path) => !(path in this.watchedPaths))
      .forEach((path) => {
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
        return !this.watchedPaths[path].syncedEndpoints[config.id];
      })
      .forEach((path) => {
        // Add path to watch list
        this.watchedPaths[path].syncedEndpoints[config.identifier] = new Set();
        // Get the module up to speed
        if (this.watchedPaths[path].currentImages.size)
          this.sendUpdates(path, config.identifier);
      });
  },
  watchPath: function (path) {
    // Find current files
    console.log(`Reading files in ${path}`);
    FS.readdir(path, (err, diskItems) => {
      if (err) return console.error(err.message);
      if (diskItems.length === 0) console.log(`No items in path ${path}`);
      diskItems.forEach((diskItem) => this.processFilePath(path, diskItem));
    });

    // Spin up a file watcher daemon
    try {
      console.log(`Watching ${path}`);
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
        console.error(err.message);
        this.watchedPaths[path]?.currentImages.delete(filename);
      } else if (stats.isDirectory()) {
        // not handling directories yet
      } else {
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

    (id ? [id] : Object.keys(this.watchedPaths[path].syncedEndpoints)).forEach(
      (id) => {
        const syncedImages = this.watchedPaths[path].syncedEndpoints[id];
        const imagesToAdd = [
          ...setSubtraction(this.watchedPaths[path].currentImages, syncedImages)
        ];
        const imagesToRemove = [
          ...setSubtraction(syncedImages, this.watchedPaths[path].currentImages)
        ];

        console.log(
          `BGSS Sending update. ${
            imagesToAdd.length && "+" + imagesToAdd.length
          } ${imagesToRemove.length && "-" + imagesToRemove.length}`
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
