/* MMM-SimpleBGSlideshow.js
 *
 * Magic Mirror
 * Module: MMM-SimpleBGSlideshow.js
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-SimpleBGSlideshow by Scott Richards
 * Inspired MMM-BackgroundSlideshow By Darick Carpenter
 * MIT Licensed.
 */

const moduleName = "MMM-SimpleBGSlideshow";

const MMM_SimpleBGSlideshow = {
  // Default module config.
  defaults: {
    // an array of strings, each is a path to a directory with images
    imagePaths: [`modules/${moduleName}/exampleImages`],
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 10 * 1000,
    // if true randomize image order, otherwise use sortImagesBy and sortImagesDescending
    randomizeImageOrder: false,
    // how to sort images: name, random, created, modified
    sortImagesBy: "created",
    // whether to sort in ascending (default) or descending order
    sortImagesDescending: false,
    // if false each path with be viewed separately in the order listed
    recursiveSubDirectories: false,
    // list of valid file extensions, separated by commas
    validImageFileExtensions: "bmp,jpg,jpeg,gif,png",

    // the gradient to make the text more visible
    gradient: [
      "rgba(0, 0, 0, 0.75) 0%",
      "rgba(0, 0, 0, 0) 40%",
      "rgba(0, 0, 0, 0) 80%",
      "rgba(0, 0, 0, 0.75) 100%"
    ],
    horizontalGradient: [
      "rgba(0, 0, 0, 0.75) 0%",
      "rgba(0, 0, 0, 0) 40%",
      "rgba(0, 0, 0, 0) 80%",
      "rgba(0, 0, 0, 0.75) 100%"
    ],
    radialGradient: [
      "rgba(0,0,0,0) 0%",
      "rgba(0,0,0,0) 75%",
      "rgba(0,0,0,0.25) 100%"
    ],
    // the direction the gradient goes, vertical, horizontal, both or radial
    gradientDirection: "vertical"
  },

  // load function
  start: function () {
    // Validate configuration
    this.config.identifier = this.identifier;
    this.config.validImageFileExtensions =
      this.config.validImageFileExtensions.toLowerCase();
    this.config.sortImagesBy = this.config.sortImagesBy.toLowerCase();

    if (!this.config.transitionImages) {
      this.config.transitionSpeed = "0";
    }

    // Ensure the backgroundAnimation duration matches the slideShowSpeed unless it has been
    // overriden
    if (this.config.backgroundAnimationDuration === "1s") {
      this.config.backgroundAnimationDuration =
        this.config.slideshowSpeed / 1000 + "s";
    }
  },

  getStyles: function () {
    return ["styles.css"];
  },

  // Notifications from server
  socketNotificationReceived: function (notification, payload) {
    const actions = {
      [`${moduleName} image list`]: () => {
        console.log(payload);
        this.curIndex = -1;
        this.imageList = payload.imageList;
        this.restartInterval();
        this.nextImage();
      }
    };
    console.log(`${moduleName}: notification`);
    if (actions[notification] && payload.identifier === this.identifier)
      actions[notification]();
  },

  // Override dom generator.
  getDom: function () {
    // Set CSS parameters (variables)
    const moduleElement = document.getElementById(this.identifier);
    const gradDirection = {
      vertical: "bottom",
      horizontal: "right"
    }[this.config.gradientDirection];
    if (gradDirection)
      moduleElement.style.setProperty("--grad-direction", gradDirection);

    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";
    this.imagesDiv = document.createElement("div");
    this.imagesDiv.className = "images";
    wrapper.appendChild(this.imagesDiv);

    if (this.config.imagePaths.length === 0) {
      Log.error(`${moduleName}: Missing required parameter imagePaths.`);
    } else {
      // create an empty image list
      this.imageList = [];
      // set beginning image index to 0, as it will auto increment on start
      this.imageIndex = 0;
      this.updateImageList();
    }

    return wrapper;
  },

  restartInterval: function () {
    if (this.intervalID) clearInterval(this.intervalID);
    this.intervalID = setInterval(
      this.nextImage.bind(this),
      this.config.slideshowSpeed
    );
  },

  nextImage: function (restartInterval = false) {
    const nextIndex = (this.curIndex + 1) % this.imageList.length;
    if (nextIndex < this.curIndex) {
      // Exhausted images in list
      this.sendSocketNotification(`${moduleName} image list`);
    }

    this.displayImage(this.imageList[nextIndex]);
    this.curIndex = nextIndex;
    if (restartInterval) this.restartInterval();
  },

  displayImage: function (path) {
    const image = new Image();
    image.onload = () => {
      const oldImages = Array.from(this.imagesDiv.childNodes).slice(0, -1);
      oldImages.forEach((oldImage) => this.imagesDiv.removeChild(oldImage));

      // Mark current one as old
      const currentImage = this.imagesDiv.childNodes[0];
      currentImage?.classList.add("old");

      // Add new image
      this.imagesDiv.appendChild(image);
    };

    image.src = path;
  },

  suspend: function () {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  resume: function () {
    this.suspend();
    const self = this;

    if (self.config.changeImageOnResume) {
      self.updateImage();
    }

    this.timer = setInterval(function () {
      // console.info('MMM-BackgroundSlideshow updating from resume');
      self.updateImage();
    }, self.config.slideshowSpeed);
  },

  updateImageList: function () {
    this.suspend();
    this.sendSocketNotification(`${moduleName} image request`, this.config);
  }
};
Module.register(moduleName, MMM_SimpleBGSlideshow);
