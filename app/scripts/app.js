'use strict';

angular.module('depthyApp', [
  'ngAnimate',
  'ngTouch',
  'ga',
  'shareUrls',
  'ui.router',
  'ui.bootstrap.buttons',
  'ui.bootstrap.modal',
  'ui.bootstrap.transition',
  'ui.bootstrap.dropdown'
])
//fix blob
.config(function($compileProvider) {
  $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|blob):|data:image\//);
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|blob):/);
})
.config(function ($stateProvider, $urlRouterProvider, $locationProvider) {
  $urlRouterProvider.otherwise('/');

  $stateProvider
  .state('index', {
    url: '/',
    onEnter: ['depthy', '$state', function (depthy, $state) {
      depthy.loadSampleImage('flowers');
    }]
  });
})
.run();