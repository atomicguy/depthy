'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($rootScope, $window, $scope, $timeout, ga, depthy, $element, $state) {

  $rootScope.depthy = depthy;
  $rootScope.viewer = depthy.viewer; // shortcut
  $rootScope.Modernizr = window.Modernizr;
  $rootScope.Math = window.Math;

  $scope.version = depthy.getVersion();

  ga('set', 'dimension1', (Modernizr.webgl ? 'webgl' : 'no-webgl') + ' ' + (Modernizr.webp ? 'webp' : 'no-webp'));

  $rootScope.$safeApply = function(fn) {
    var phase = this.$root.$$phase;
    if(phase === '$apply' || phase === '$digest') {
      if(fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };

  $scope.loadSample = function(name) {
    $state.go('sample', {id: name});
  };

  $scope.openImage = function(image) {
    $state.go(image.state, image.stateParams);
  };

  $scope.$watch('compoundFiles', function(files) {
    if (files && files.length) {
      depthy.loadLocalImage(files[0]).then(
        function() {
          ga('send', 'event', 'image', 'parsed', depthy.hasDepthmap() ? 'depthmap' : 'no-depthmap');
          depthy.opened.openState();
        },
        function(e) {
          ga('send', 'event', 'image', 'error', e);
        }
      );
    }
  });

  $scope.$watch('depthy.useOriginalImage', function() {
    depthy.refreshOpenedImage();
  });

  $scope.debugClicksLeft = 2;
  $scope.debugClicked = function() {
    if (--$scope.debugClicksLeft === 0) depthy.enableDebug();
  };

  $scope.$watch('viewer.fit', function(fit) {
    if (fit === 'cover') {
      depthy.viewer.upscale = 4;
    } else if (fit === 'contain') {
      depthy.viewer.upscale = 1;
    }
  });

  $scope.$on('pixi.webgl.init.exception', function(evt, exception) {
    console.error('WebGL Init Exception', exception);
    Modernizr.webgl = false;
    ga('send', 'event', 'webgl', 'exception', exception.toString(), {nonInteraction: 1});
  });

  $($window).on('resize', function() {
    var $viewer = $('#viewer');
    depthy.viewer.size = {
      width:  $viewer.width(),
      height: $viewer.height(),
    };
    console.log('Resize %dx%d', $viewer.width(), $viewer.height());
    $scope.$safeApply();
  });
  $($window).resize();
});