'use strict';

var repeat = require('handlebars-helper-repeat');

module.exports.register = function(Handlebars, options) {
  Handlebars.registerHelper('repeat', repeat);
};
