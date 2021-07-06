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
const moduleName = "MMM-SimpleBGSlideshow";

module.exports = NodeHelper.create({
  expressInstance: undefined,
  // subclass start method, clears the initial config array
  start: function () {
    this.validImageFileExtensions = new Set();
    this.expressInstance = this.expressApp;
    this.imageList = [];
    this.boundRoutes = new Set();
    this.curIndex = 0;
  },

  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function (notification, payload) {
    Log.info(notification);

    const actions = {
      [`${moduleName} image request`]: () => {
        const config = payload;

        // Create express routes for this moddule
        const oneDay = 24 * 60 * 60 * 1_000;
        config.imagePaths
          .filter((path) => !this.boundRoutes.has(path))
          .forEach((path) => {
            this.expressInstance.use(
              "/" + path,
              express.static(path, {
                maxAge: oneDay
              })
            );
            this.boundRoutes.add(path);
          });

        const validExtensionsList = config.validImageFileExtensions
          .toLowerCase()
          .split(",");
        const validExtensionsSet = new Set(validExtensionsList);

        prepareImageList(config, validExtensionsSet).then((imagePaths) => {
          this.sendSocketNotification(`${moduleName} image list`, {
            identifier: config.identifier,
            imageList: imagePaths
          });
        });
      }
    };
    if (actions[notification]) {
      // Run the action
      actions[notification]();
    }
  }
});

const prepareImageList = async function (config, validExtensions) {
  const getFiles = async function (pathName, recurse, validExtensions) {
    Log.info(`${moduleName}: Reading directory "${pathName}" for images.`);

    // Non-bocking read dir code
    const filesAndFolderNames = await FSPromises.readdir(pathName);

    const filePromises = filesAndFolderNames.map(async (fileOrFolderName) => {
      const fullPath = pathName + "/" + fileOrFolderName;
      const stats = await FSPromises.stat(fullPath);

      if (stats.isDirectory() && recurse) {
        return getFiles(fullPath, recurse, validExtensions);
      }

      if (stats.isFile()) {
        return {
          path: fullPath,
          created: stats.ctimeMs,
          modified: stats.mtimeMs
        };
      }
      throw `${fileOrFolderName} is not a directory or file!`;
    });

    const files = (await Promise.all(filePromises))
      .flat()
      .filter(({ path }) => {
        // Remove '.'
        const extension = pathModule.extname(path).substring(1);
        return validExtensions.has(extension);
      });
    return files;
  };
  const imagePaths = (
    await Promise.all(
      config.imagePaths.map((path) => {
        return getFiles(path, config.recurse, validExtensions);
      })
    )
  ).flat();

  const shuffleArray = function (array) {
    for (let i = array.length - 1; i > 0; i--) {
      // j is a random index in [0, i].
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const sortImageList = function (imageList, sortBy, sortDescending) {
    const sortVals = {
      created: (el) => el.created,
      modified: (el) => el.modified,
      filename: (el) => el.path.toLocaleLowerCase()
    };
    const defaultSort = sortVals.filename;

    const sortValFn = sortVals[sortBy] || defaultSort;

    return imageList.sort((a, b) => {
      const reverse = -1 * sortDescending;
      return reverse * (sortValFn(a) - sortValFn(b));
    });
  };

  const sortedPaths = config.randomizeImageOrder
    ? shuffleArray(imagePaths)
    : sortImageList(
        imagePaths,
        config.sortImagesBy,
        config.sortImagesDescending
      );

  const rawSortedPaths = sortedPaths.map((p) => p.path);
  Log.info(`${moduleName}: ${rawSortedPaths.length} files found`);
  return rawSortedPaths;
};
