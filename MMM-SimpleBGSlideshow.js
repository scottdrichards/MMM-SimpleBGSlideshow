/* MMM-SimpleBGSlideshow.js
 *
 * Magic Mirror
 * Module: MMM-SimpleBGSlideshow.js
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-SimpleBGSlideshow by Scott Richards
 * Heavily Inspired MMM-BackgroundSlideshow By Darick Carpenter
 * MIT Licensed.
 */

const moduleName = "MMM-SimpleBGSlideshow";

const MMM_SimpleBGSlideshow = {
  // Default module config.
  defaults: {
    // an array of strings, each is a path to a directory with images
    imagePaths: [], // resolves relative to MM root. So 'images' => ~MagicMirror/images
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 10_000,

    // Amount of time for a fade-in to be done (CSS string)
    fadeInTime: "2s",

    // the gradient to make the text more visible
    gradientDirection: "vertical", //vertical, horizontal, radial
    gradientOpacity: 0.75, // 1 is black
    linearGradientTopOrLeft: "40%", // When does the gradient start at the top
    linearGradientBottomOrRight: "40%", // When does the gradient start at the bottom
    radialGradientStart: "30%", // When does the gradient start for radial

    brightenText: true // override global text colors to be brighter
  },

  // load function
  start: function () {
    // Because we send config information to node_modules, we include the identifier
    const sessionID = Math.floor(Math.random() * 10_000);
    this.config.identifier = sessionID + "_" + this.identifier;

    this.curIndex = -1;
    this.imageList = [];
    this.sendSocketNotification(`subscribe`, this.config);
  },

  getStyles: function () {
    return ["styles.css"];
  },

  notificationReceived: function (notification, payload) {
    Log.info(notification, payload);
  },

  // Notifications from server
  socketNotificationReceived: function (notification, payload) {
    const actions = {
      [`IMAGE_PATH_UPDATE`]: () => {
        Log.info(payload);
        const { path, imagesToAdd, imagesToRemove } = payload;
        const addPaths = imagesToAdd.map((p) => path + p);
        const removePaths = imagesToRemove.map((p) => path + p);
        this.imageList = this.imageList
          .concat(addPaths)
          .filter((i) => !removePaths.some((r) => r === i));

        // If we don't have a slideshow going, start it
        if (!this.intervalID) {
          this.nextImage(true);
        }
      }
    };
    Log.info(`${moduleName}: notification`);
    if (actions[notification] && payload.identifier === this.config.identifier)
      actions[notification]();
  },

  // Override dom generator.
  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";

    // Add classes for gradients
    const gradientClasses = {
      vertical: ["linearGradient", "vertical"],
      horizontal: ["linearGradient", "horizontal"],
      radial: ["radialGradient"]
    }[this.config.gradientDirection];
    if (gradientClasses) wrapper.classList.add(...gradientClasses);
    // CSS custom properties for gradients
    [
      "gradientOpacity",
      "linearGradientTopOrLeft",
      "linearGradientBottomOrRight",
      "radialGradientStart",
      "fadeInTime"
    ].forEach((prop) =>
      wrapper.style.setProperty(`--${prop}`, this.config[prop])
    );

    if (this.config.brightenText) document.body.classList.add("brighterColors");

    this.imagesDiv = document.createElement("div");
    this.imagesDiv.className = "images";
    wrapper.appendChild(this.imagesDiv);

    if (this.config.imagePaths.length === 0) {
      Log.error(`${moduleName}: Missing required parameter imagePaths.`);
    }

    return wrapper;
  },

  /**
   * Triggers the next image in the sequence
   *
   * @param {boolean} startInterval  should it (re)start the slideshow?
   */
  nextImage: function (startInterval = false) {
    this.curIndex = (this.curIndex + 1) % this.imageList.length;
    this.displayImage(this.imageList[this.curIndex]);
    if (startInterval) {
      if (this.intervalID) clearInterval(this.intervalID);
      this.intervalID = setInterval(
        this.nextImage.bind(this),
        this.config.slideshowSpeed
      );
    }
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
    image.onerror = () => {
      this.imageList = this.imageList.filter((i) => i !== path);
      this.nextImage();
    };

    image.src = path;
  }
};
Module.register(moduleName, MMM_SimpleBGSlideshow);
