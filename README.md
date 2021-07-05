# Simple Background Slideshow
This module is a spiritual fork from [Darick Carpenter's BackgroundSlideshow](https://github.com/darickc/MMM-BackgroundSlideshow). I wrote a new module from scratch while using his for reference. There were two main problems that I wanted to fix:
1. Because of synchronous file system calls, if there were a large number of images to search and a slow computer, the event loop would hang and the Node server would crash. This was fixed by utilizing the file system promise API for asynchronous calls.
2. Some image data was transferred over the socket. This does not take advantage of browser image processing features and might congest the socket so I removed it to only rely on express for hosting images and the browser accessing images via link.


I also trimmed features that seemed to have limited use for most people. If there are missing features that people would like, I would be happy to add them in.
Stylistically, I removed most chained if/else statements in favor of early return or key/value switch objects.

## Installation
    cd ~/MagicMirror/modules/
    git clone https://github.com/scottdrichards/MMM-SimpleBGSlideshow

The only dependency for this module is express. This is already loaded with Magic Mirror but you can install it explicitly just to be sure:
    
    cd ./MMM-SimpleBGSlideshow
    npm i

## Usage
You can add the following to your main configuration file:

    {
        module: 'MMM-SimpleBGSlideshow',
        position: 'fullscreen_below',
        config: {
            imagePaths: ['images/'],
            slideshowSpeed: 15000,
            randomizeImageOrder: false,
        }
    }
## Configuration
|Parameter | Usage| Example|
|----------|----------|----------|
|`imagePaths`|An array of paths for images to be taken from|`["images","oldImages"]`|
|`slideshowSpeed`|Number of milliseconds to show each image|`10000`|
`sortImagesBy`|Sort the images by `name`, `random`, `created` (file creation, not image date taken), or `modified`|`created`|
|`sortImagesDescending`|Sort the images in descending order|`true`|
|`randomizeImageOrder`|Randomize the order to show images. Each image will still be shown once per rotation|`false`|
|`recursiveSubDirectories`|Include subdirectories of image paths?|`false`|
|`validImageFileExtensions`|Which image extensions to include. Make sure to only do [extensions that the browser can render](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#supported_image_formats).|`"bmp,jpg,jpeg,gif,png"`|
|`brightenText`|Brightens the all MagicMirror text for easier viewing|`true`|
|`gradient`|An object that describes the gradient to be applied so that text/modules are easier to read.| see below

Here is how to configure the gradient object

    {
      direction: "linear", //vertical, horizontal, radial`
      opacity: 0.75, // 1 is black
      stop1: "40%", // linear first stop, radial start gradient
      stop2: "80%" // linear second start, radial end gradient (i.e., 120%)
    }

# Screenshots
## Linear Gradient
![Linear Gradient Example](/screenshots/Linear%20Gradient.jpg)
## Radial Gradient
![Radial Gradient Example](/screenshots/Radial%20Gradient.jpg)