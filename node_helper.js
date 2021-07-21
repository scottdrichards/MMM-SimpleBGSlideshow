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
const FSPromises = require("fs").promises;
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
          abortController: new AbortController(),
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
    FSPromises.readdir(path).then((diskItems) => {
      diskItems.map((diskItem) => this.processFilePath(path, diskItem));
    });

    // Spin up a file watcher daemon
    try {
      const watcher = FSPromises.watch(
        path,
        this.watchedPaths[path].abortController.abortSignal
      );
      (async () => {
        // Async portion that will keep running in background
        console.log(`Watching ${path}`);
        for await (const event of watcher) {
          // New file change detected
          if (event.eventType === "rename") {
            // "rename" is used for add/delete/rename. A rename will actully
            // cause two calls, one for the old file name and one for the new

            // Now lets see if it is a file path we care about
            this.processFilePath(path, event.filename);
          }
        }
        console.log(`No longer watching ${path}`);
      })(); // async IIFE
    } catch (err) {
      if (err.name === "AbortError") return;
      throw err;
    }
  },
  processFilePath: function (path, filename) {
    const filePath = pathModule.join(path, filename);
    FSPromises.stat(filePath)
      .then((stats) => {
        this.watchedPaths[path].currentImages.add(filename);
      })
      .catch((error) => {
        console.error(error);
        this.watchedPaths[path]?.currentImages.delete(filename);
      })
      .finally(() => {
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
