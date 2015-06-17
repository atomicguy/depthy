DEPTHY
======

This project is just a stripped version of the original Depthy, which contains some cool features about creating your own DOF pictures, exporting files and sharing.

In this version, we only care about showing a given picture with the fancy paralax effect presented by Depthy

---

Images with depthmap playground.

Depthy shows Google Camera Lens Blur photos with 3D parallax effect and creates animated GIFs from them. Plus extracts the depth map and enables you to create your own!

This is the source of the http://depthy.me/ webapp. Contributions more than welcome!

## How to build

- Install node + npm
- Run anywhere: `npm install -g grunt-cli bower`
- Run in project directory: `npm install` and `bower install`
- For local development server run: `grunt serve`
- For deployment: `grunt build`

## How to use your own pictures

1. Under the folder `app/samples` place the picture and its corresponding depth of field picture with the following names:

  - \<name\>-image.jpg
  - \<name\>-depth.jpg

2. Change the samples attribute of the depthy script. It's located at `app/scripts/services/depthy.js`. It should be something like this:

  ```js
    // the id and name of the picture to be loaded
    // this id is the <name> you have named your pictures in the previous step
    samples: [
      { id: 'name', title: 'Name'}
    ],
  ```
    
3. Change the name of the image firstly loaded on `app/scripts/app.js`, with the id you'd chosen for your picture.

  ```js
    onEnter: ['depthy', '$state', function (depthy, $state) {
      depthy.loadSampleImage('name');
    }]
  ```
  
## Authors

**[Rafał Lindemann](http://www.stamina.pl/)** (idea, code, ux) with much appreciated help of
**[Łukasz Marcinkowski](http://th7.org/)** (idea, code)

## How to help

There is a lot of stuff you can do with depthmaps. If you have ideas and you know how to code,
You already know how to help ;) I'm pretty lax on formalities, just make it work and at least 
try to follow conventions of the code...

## License

The MIT License

Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

