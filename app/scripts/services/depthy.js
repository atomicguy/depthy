'use strict';

angular.module('depthyApp').provider('depthy', function depthy() {

  // global settings object, synchronized with the remote profile, only simple values!
  var viewer = angular.extend({}, DepthyViewer.defaultOptions, {
    hoverElement: 'body',
    fit: Modernizr.mobile ? 'cover' : 'contain',
    depthScale: Modernizr.mobile ? 2 : 1,
  });

  this.$get = function(ga, $timeout, $rootScope, $document, $window, $q, $state) {

    var leftpaneDeferred, depthy,
      history = [];

    function isImageInfo(info) {
      return info && info.isStoreable;
    }

    function createImageInfo(info) {

      var self = angular.extend({
        imageSource: null,
        depthSource: null,
        depthUsesAlpha: false,
        originalSource: null,

        // state it was opened from
        state: null,
        stateParams: null,

        // True if waiting for results
        loading: false,
        // loaded from this url
        url: undefined,
        // TRUE if local file
        local: undefined,
         // image was parsed
        parsed: undefined,
        // id of local sample
        sample: undefined,
        // 
        title: false,
        // thumbnail url
        thumb: false,
        // storage service used
        store: false,
        // stored under this url
        storeUrl: false,
        // store secret key, if any
        storeKey: false,

        // time when first added to history
        added: false,
        // time last viewed
        viewed: false,
        // views count
        views: 0,

        isStoreable: function() {
          return !!(self.isConfirmed() && self.thumb && self.thumb.length < 500);
        },
        isEmpty: function() {
          return !(self.url || self.local || self.sample || self.procesing) || self.empty;
        },
        isOpened: function() {
          return depthy.opened === self;
        },
        // returns true for images that loaded successfully in the past
        isConfirmed: function() {
          return self.viewed || self.sample && self.thumb;
        },
        isLocal: function() {
          return !!self.local;
        },
        isSample: function() {
          return !!self.sample;
        },
        isRemote: function() {
          return !!self.url;
        },
        isModified: function() {
          return !!self.modified;
        },
        isAvailable: function() {
          return !depthy.isOffline() || this.isSample() || this.isLocal();
        },
        // returns the type
        getType: function() {
          if (self.isLocal()) return 'local';
          if (self.isModified()) return 'modified';
          if (self.isSample()) return 'sample';
          if (self.isRemote()) return 'remote';
          return 'unknown';
        },
        getFilename: function() {
          return self.title || (self.stateParams && self.stateParams.id) || 'image';
        },
        getStateUrl: function() {
          if (!self.state) return false;
          return $state.href(self.state, self.stateParams || {});
        },
        openState: function() {
          if (!self.state) throw 'No state to go to';
          $state.go(self.state, self.stateParams);
        },
        markAsModified: function() {
          // it's no longer shared here!
          self.modified = true;
        },
        onOpened: function() {
          self.loading = false;
          self._checkIfReady();
        },
        // fire when depthmap is opened later on
        onDepthmapOpened: function() {
          self.loading = false;
          self._checkIfReady();
        },
        _checkIfReady: function() {
          if (!self.state) return false;
          if (!self.isOpened() || !depthy.isReady() || !depthy.hasDepthmap()) return false;
          this.onViewed();
        },
        onViewed: function() {
          if (!self.thumb) {
            depthy.getViewer().exportImage({size: {width: 75, height: 75}, quality: 0.8}).then(function(url) {
              self.thumb = url;
              console.log('Thumbnail generated %db', url.length);
              $rootScope.$safeApply();
            });
          }
          self.viewed = new Date().getTime();
          self.views += 1;
          storeImageHistory();
          $rootScope.$safeApply();
        },
        onClosed: function() {
          // cleanup a bit
          if (!self.sample && !self.isModified()) {
            self.imageSource = self.depthSource = self.originalSource = self.depthUsesAlpha = false;
          }
          self.loading = false;
        },
        addToHistory: function() {
          if (history.indexOf(self) < 0) {
            if (self.added === false) self.added = new Date().getTime();
            history.push(self);
          }
        },
        removeFromHistory: function() {
          _.remove(history, function(a) {return a === self;});
        },
        // tries to reopen this image if it has minimum set of info. Returns promise on success
        tryToReopen: function() {
          if (self.isOpened()) return depthy.getReadyPromise();
          // imageSource is enough to open
          if (!self.imageSource) return false;
          console.log('%cReopening image: %o', 'font-weight: bold', self);
          openImage(self);
          depthy.getViewer().setDepthmap(self.depthSource, self.depthUsesAlpha);
          return depthy.refreshOpenedImage()
          // .catch(function() {
          //  self.error = 'Image could not be reopened!';
          // })
          .finally(self.onOpened);
        }
      }, info || {});
      return self;
    }

    /* @param info - image info to lookup
       @param createMode - truey creates missing image, 'extend' extends existing, otherwise defaults existing */
    function lookupImageHistory(info, createMode) {
      var image;
      if (isImageInfo(info)) return info;
      if (info.state) {
        if (info.state === true) {
          info.state = $state.current.name;
          info.stateParams = $state.params;
          // console.log('lookupImageHistory state detected as ', info.state, info.stateParams);
        }
        image = _.find(history, {state: info.state, stateParams: info.stateParams});
        // console.log('%cFound %o in history when looking for %o', 'font-weight:bold', image, info);
      }
      if (image) {
        _[createMode === 'extend' ? 'extend' : 'defaults'](image, info);
      } else if (createMode) {
        image = createImageInfo(info);
        if (image.state) image.addToHistory();
      }
      return image;
    }

    // used internally
    function prepareImage(info, extraInfo) {
      if (extraInfo) info = angular.extend(info, extraInfo);
      var opened = lookupImageHistory(info, 'extend');
      return opened;
    }

    function openImage(image) {
      if (image.isOpened()) return image;
      if (depthy.opened) {
        depthy.opened.onClosed();
        depthy.getViewer().reset();
      }
      image.loading = true;
      depthy.opened = image;
      return depthy.opened;
    }

    var storeImageHistory = _.throttle(function storeImageHistory() {
      if (!Modernizr.localstorage) return;

      var store = history.filter(function(image) {
        return image.isStoreable();
      }).map(function(image) {
        return _.pick(image, ['state', 'stateParams', 'title', 'url', 'thumb', 'added', 'viewed', 'views', 'storeKey']);
      });

      console.log('storeImageHistory', history, store);
      window.localStorage.setItem('history', JSON.stringify(store));

    }, 4000, {leading: false});

    function restoreImageHistory() {
      // recreate samples
      depthy.samples.forEach(function(sample) {
        lookupImageHistory({
          state: 'sample',
          stateParams: {id: sample.id},
          sample: sample.id,
          title: sample.title,
          thumb: 'samples/' + sample.id + '-thumb.jpg',
          imageSource: 'samples/' + sample.id + '-image.jpg',
          depthSource: 'samples/' + sample.id + '-depth.jpg',
          originalSource: 'samples/' + sample.id + '-alternative.jpg',
          added: 0,
        }, true);
      });

      // read history
      if (!Modernizr.localstorage) return;
      var stored = JSON.parse(localStorage.getItem('history') || 'null');
      if (!angular.isObject(stored)) return;
      console.log('restoreImageHistory', stored);
      stored.forEach(function(image) {
        // don't recreate non existing samples... default the rest.
        image = lookupImageHistory(image, image.state === 'sample' ? false : 'default');
        if (image && !image.isStoreable()) image.removeFromHistory();
      });
    }

    var _storeableViewerKeys = ['fit', 'animate', 'animateDuration', 'animatePosition', 'animateScale', 'depthScale', 'depthFocus', 'tipsState', 'qualityStart'],
        _storeableDepthyKeys = ['useOriginalImage', 'exportSize', 'tipsState'];

    var storeSettings = _.throttle(function storeSettings() {
      if (!Modernizr.localstorage) return;
      if (depthy.isViewerOverriden()) return;
      var store = _.pick(depthy, _storeableDepthyKeys);
      store.viewer = _.pick(viewer, _storeableViewerKeys);
      store.version = depthy.version;
      store.storedDate = new Date().getTime();

      console.log('storeSettings', store);
      window.localStorage.setItem('settings', JSON.stringify(store));

    }, 4000, {leading: false});

    function restoreSettings() {
      // read history
      if (!Modernizr.localstorage) return;
      var stored = JSON.parse(localStorage.getItem('settings') || 'null');
      if (!angular.isObject(stored)) return;

      _.merge(depthy, _.pick(stored, _storeableDepthyKeys));
      _.merge(depthy.viewer, _.pick(stored.viewer, _storeableViewerKeys));

      depthy.storedDate = stored.storedDate;
      if (stored.version !== depthy.version) {
        installNewVersion(stored.version);
      }

      console.log('restoreSettings', stored);
    }

    function initialize() {

      openImage(createImageInfo({empty: true}));

      restoreSettings();
      restoreImageHistory();

      $rootScope.$watch(function() {
        var store = _.pick(depthy, _storeableDepthyKeys);
        store.viewer = _.pick(viewer, _storeableViewerKeys);
        return store;
      }, function(n, o) {
        if (n === o) return;
        storeSettings();
      }, true);

      // monitor quality
      $rootScope.$watch(function() {
        return depthy.getViewer().getQuality();
      }, function(n, o) {
        if (n === o) return;
        viewer.qualityStart = depthy.getViewer().getQuality();
        ga('set', 'dimension2', viewer.qualityStart);
        storeSettings();
      }, true);
    }

    depthy = {
      viewer: viewer,

      version: 301,
      tipsState: {},
      lastSettingsDate: null,

      exportSize: Modernizr.mobile ? 150 : 300,
      exportType: 'gif',

      imgurId: 'b4ca5b16efb904b',

      // true - opened fully, 'gallery' opened on gallery
      activePopup: null,

      movearoundShow: false,

      drawMode: false,

      opened: null,

      useOriginalImage: false,

      debug: false,

      gallery: [],

      // the id and name of the picture to be loaded
      samples: [
        { id: 'teacup', title: 'Teacup'}
      ],

      stores: {
        imgur: {
          name: 'imgur'
        }
      },

      getVersion: function() {
        return Math.floor(this.version / 10000) + '.' + Math.floor(this.version % 10000 / 100) + '.' + (this.version % 100);
      },
      isReady: function() {
        return this.getViewer().isReady();
      },
      isLoading: function() {
        return !!this.opened.loading && Modernizr.webgl;
      },
      hasImage: function() {
        return this.getViewer().hasImage();
      },
      hasDepthmap: function() {
        return this.getViewer().hasDepthmap();
      },
      hasOriginalImage: function() {
        return !!this.opened.originalSource;
      },
      hasCompleteImage: function() {
        return this.hasImage() && this.hasDepthmap();
      },
      getLoadError: function() {
        return this.opened.error;
      },
      // true when leftpane is incollapsible
      isFullLayout: function() {
        return $window.innerWidth >= 1200;
      },
      isOffline: function() {
        return navigator.onLine === false;
      },
      isViewerOverriden: function(override) {
        if (override !== undefined) depthy.viewerOverriden = override;
        return depthy.viewerOverriden || depthy.exportActive;
      },
      getViewerCtrl: function() {
        if (!this._viewerCtrl) {
          this._viewerCtrl = angular.element('[depthy-viewer]').controller('depthyViewer');
        }
        return this._viewerCtrl;
      },

      getViewer: function() {
        if (!this._viewer) {
          this._viewer = this.getViewerCtrl().getViewer();
        }
        return this._viewer;
      },

      storeSettings: storeSettings,

      // sets proper image according to opened image and useOriginalImage setting
      refreshOpenedImage: function() {
        var opened = this.opened;
        this.getViewer().setImage((depthy.useOriginalImage ? opened.originalSource : opened.imageSource) || opened.imageSource);
        return this.getReadyPromise();
      },

      getReadyPromise: function() {
        return $q.when(depthy.getViewer().getPromise());
      },

      loadImage: function(image) {
        var opened = prepareImage(image);
        if (opened.tryToReopen()) return this.getReadyPromise();
        return $q.reject('Image can\'t be loaded!');
      },

      loadSampleImage: function(name) {
        // samples are already defined, can be only reopened
        return this.loadImage({
          state: 'sample',
          stateParams: {id: name},
        });
      },

      _fileId: 0,
      loadLocalImage: function(file) {

        var fileId = _.isObject(file) ? (++ this._fileId) + '' : file,
        opened = prepareImage({
          state: 'local',
          stateParams: {id: fileId},
          local: true,
          parsed: true,
        });
        if (opened.tryToReopen()) return this.getReadyPromise();
        openImage(opened);

        if (_.isObject(file)) {
          opened.title = (file.name || '').replace(/\.(jpe?g|png)$/i, '');
          opened.imageFile = file;
        } else {
          file = opened.imageFile;
          console.log('Reopening old file', file);
        }

        var deferred = $q.defer();

        if (!file) {
          deferred.reject('Can\'t open this image anymore');
        } else if (file.type && file.type !== 'image/jpeg' && file.type !== 'image/png') {
          deferred.reject('Only JPEG and PNG, please!');
        } else {
          var reader = new FileReader();
          reader.onload = function() {
            deferred.resolve(reader.result);
          };
          reader.readAsArrayBuffer(file);
        }

        return deferred.promise.then(function(data) {
          return depthy._loadFromArrayBuffer(data, opened);
        })
        .catch(function(err) {
          opened.error = err;
        })
        .finally(opened.onOpened);

      },

      loadUrlImage: function(url, openedInfo) {
        var opened = prepareImage({
          url: url,
          parsed: true,
        }, openedInfo);
        if (opened.tryToReopen()) return this.getReadyPromise();
        openImage(opened);

        var xhr = new XMLHttpRequest(),
            deferred = $q.defer();
        //todo: cors
        xhr.open( 'get', url );
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          deferred.resolve(this.response);
        };
        xhr.onerror = function() {
          deferred.reject();
        };
        xhr.send( null );

        return deferred.promise.then(function(data) {
          return depthy._loadFromArrayBuffer(data, opened);
        })
        .catch(function(err) {
          opened.error = angular.isString(err) ? err : 'Image not found!';
        })
        .finally(opened.onOpened);

      },


      loadUrlDirectImage: function(url, isPng, openedInfo) {
        var opened = prepareImage({
          url: url,
          imageSource: url,
          depthSource: isPng ? url : false,
          depthUsesAlpha: isPng,
        }, openedInfo);
        if (opened.tryToReopen()) return this.getReadyPromise();
        openImage(opened);

        this.getViewer().setDepthmap(opened.depthSource, isPng);
        return depthy.refreshOpenedImage()
          .catch(function(err) {
            opened.error = angular.isString(err) ? err : 'Image not found!';
          })
          .finally(opened.onOpened);
      },

      _loadFromArrayBuffer: function(buffer, opened) {
        var byteArray = new Uint8Array(buffer);
        if (isJpg(byteArray)) {
          var reader = new DepthReader(),
              deferred = $q.defer();

          var result = function(error) {
            // no matter what, we use it...
            console.log('DepthExtractor result', error);
            opened.imageSource = URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) );
            opened.depthSource = reader.depth.data ? 'data:' + reader.depth.mime + ';base64,' + reader.depth.data : false;
            opened.originalSource = reader.image.data ? 'data:' + reader.image.mime + ';base64,' + reader.image.data : false;
            depthy.getViewer().setDepthmap(opened.depthSource);
            deferred.resolve(depthy.refreshOpenedImage());
          };

          reader.parseFile(buffer, result, result);
          return deferred.promise;
        } else if (isPng(byteArray)) {
          // 8b signature, 4b chunk length, 4b chunk type
          // IHDR: 4b width, 4b height, 1b bit depth, 1b color type
          var bitDepth = byteArray[24],
              colorType = byteArray[25],
              isTransparent = colorType === 4 || colorType === 6,
              imageSource = URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) );
          console.log('PNG depth %d colorType %d transparent %s', bitDepth, colorType, isTransparent);

          opened.imageSource = imageSource;
          opened.depthSource = isTransparent ? imageSource : false;
          opened.depthUsesAlpha = isTransparent;
          opened.originalSource = false;

          depthy.getViewer().setDepthmap(opened.depthSource, isTransparent);
          return depthy.refreshOpenedImage();

        } else {
          $q.reject('Only JPEG and PNG, please!');
        }
      },

      loadLocalDepthmap: function(file) {
        var reader = new FileReader(),
            deferred = $q.defer(),
            opened = depthy.opened;

        if (file.type === 'image/jpeg') {
          // look for depthmap
          reader.onload = function() {
            var buffer = reader.result,
                byteArray = new Uint8Array(buffer);
            if (isJpg(byteArray)) {
              var depthReader = new DepthReader();
              opened.loading = true;
              var result = function() {
                opened.depthSource = depthReader.depth.data ?
                    'data:' + depthReader.depth.mime + ';base64,' + depthReader.depth.data :
                    URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}));
                opened.depthUsesAlpha = false;
                depthy.getViewer().setDepthmap(opened.depthSource);
                deferred.resolve(depthy.getViewer().getPromise());
                deferred.promise.finally(opened.onDepthmapOpened);
              };
              depthReader.parseFile(buffer, result, result);
            } else {
            }
          };
          reader.readAsArrayBuffer(file);
        } else if (file.type === 'image/png') {
          opened.loading = true;
          opened.depthSource = URL.createObjectURL( file );
          opened.depthUsesAlpha = false;
          depthy.getViewer().setDepthmap(opened.depthSource);
          deferred.resolve(depthy.getViewer().getPromise());
          deferred.promise.finally(opened.onDepthmapOpened);
        } else {
          deferred.reject('Only JPEG and PNG files are supported!');
        }
        deferred.promise.finally(function() {
          opened.markAsModified();
        });
        return deferred.promise;

      },
      
      exportWebmAnimation: function() {
        var deferred = $q.defer(), promise = deferred.promise, encoder, aborted = false;

        Modernizr.load({
          test: window.Whammy,
          nope: 'bower_components/whammy/whammy.js',
          complete: function() {
            var size = {width: depthy.exportSize, height: depthy.exportSize},
                duration = viewer.animateDuration,
                fps = Math.min(30),
                frames = Math.max(4, Math.round(duration * fps)),
                viewerObj = depthy.getViewer(),
                oldOptions = viewerObj.getOptions();

            encoder = new Whammy.Video(fps, 0.9);
            console.log('FPS %d Frames %d Scale %d Size %d Duration %d', fps, frames, viewer.depthScale, depthy.exportSize, duration);

            promise.finally(function() {
              oldOptions.pauseRender = false;
              viewerObj.setOptions(oldOptions);
            });

            var frame = 0;
            function worker() {
              if (aborted) {
                encoder = null;
                return;
              }
              try {
                if (frame < frames) {
                  deferred.notify(frame/frames);
                  viewerObj.setOptions({
                    size: size,
                    animate: true,
                    fit: false,
                    animatePosition: frame / frames,
                    quality: 5,
                    // make it 8, so it converts nicely to other video formats...
                    sizeDivisible: 8,
                    pauseRender: true,
                  });
                  viewerObj.render(true);
                  encoder.add(viewerObj.getCanvas());
                  ++frame;
                  // wait every 4 frames
                  if (frame % 4 === 0) {
                    setTimeout(worker, 0);
                  } else {
                    worker();
                  }
                } else {
                  var blob = encoder.compile();
                  deferred.resolve(blob);
                  depthy.viewer.overrideStageSize = null;
                  $rootScope.$safeApply();
                }
              } catch (e) {
                deferred.reject(e);
              }
            }
            setTimeout(worker, 0);

          }
        });
        promise.abort = function() {
          aborted = true;
        };
        return promise;
      },

      animateOption: function(obj, option, duration) {
        $(obj).animate(option, {
          duration: duration || 250,
          step: function() {$rootScope.$safeApply();},
          complete: function() {
            _.extend(obj, option);
            $rootScope.$safeApply();
          }
        });
      },

      reload: function() {
        $window.location.reload();
      },

      enableDebug: function() {
        depthy.debug = true;
        Modernizr.load({
          test: window.Stats,
          nope: 'bower_components/stats.js/build/stats.min.js',
          complete: function() {
            depthy.getViewer().enableDebug();
          }
        });
      }
    };

    initialize();

    return depthy;
  };
});


