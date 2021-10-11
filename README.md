# Simple Background Slideshow
This module is a spiritual fork from [Darick Carpenter's BackgroundSlideshow](https://github.com/darickc/MMM-BackgroundSlideshow). I wrote a new module from scratch while using his for reference. There were a few issues I wanted to address:
1. Because of synchronous file system calls, if there were a large number of images to search and a slow computer, the event loop would hang and the Node server would crash. This was fixed by utilizing the file system promise API for asynchronous calls.
2. Some image data was transferred over the socket. The author did this to overcome some bugs people were seeing and to make it so that problematic filenames were no longer an issue. However, this does not take advantage of browser image data management features and might congest the socket so I removed it to only rely on express for hosting images and the browser accessing images via link.
3. The server and client were too intertwined for my liking. I made it so that most of the logic is now done at the client with minimal interaction with the server, just requesting new images.
4. I wanted to make the CSS and JS more clean and readable.
5. The backend watches for changes and automatically updates the client. No refresh required

## Some limitations
1. It does not do recursive search of image folders. This is because the file watcher in Node only can recursively watch on some systems without using polling (expensive). You can still include sub-folders but you must do so explicitly.
2. It does not do image transitions. For some reason Chrome on the Raspberry Pi does not do image transitions well. My guess is that it does not take advantage of hardware accelleration for such tasks.


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
        }
    }
## Configuration
|Parameter | Usage| Example|
|----------|----------|----------|
|`imagePaths`|An array of paths for images to be taken from|`["images","oldImages"]`|
|`slideshowSpeed`|Number of milliseconds to show each image|`10000`|
|`brightenText`|Brightens the all MagicMirror text for easier viewing|`true`|
|`gradientDirection`|vertical, horizontal, radial|`vertical`|
|`gradientOpacity`|1 is black|`0.75`|
|`linearGradientTopOrLeft`|When does the gradient start at the top (or left for horizontal)|`40%`|
|`linearGradientBottomOrRight`|When does the gradient start at the bottom (or right for horizontal)|`40%`|
|`radialGradientStart`|When does the gradient start for radial|`30%`|
|`fadeInTime`|How long a fade-in should be, using CSS string|`2s`|
|`loadDelay`|Should the module wait to load? This is helpful if other operations are clogging io and things aren't working. For my pi zero I found that setting this to a minute or so helped overcome errors. In ms. |`60000`|

# Screenshots
## Linear Gradient
![Linear Gradient Example](/screenshots/Linear%20Gradient.jpg)
## Radial Gradient
![Radial Gradient Example](/screenshots/Radial%20Gradient.jpg)
