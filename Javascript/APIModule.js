/*

    Created By : Elliot Francis
    Description : The Base Class for an API endpoint. This library exists to
    make it easier to automate the adding of routes to an express based
    API application server

*/

(function () {
  'use strict'

  var APIModule = function () {
    var self = this;
    self.routes = [];
    self.socket_listeners = [];
  };

  APIModule.prototype.addRoute = function (path, type, handler, middleware) {
    if(path == "" || typeof path == "undefined") { return false; }
    if(type == "" || typeof type == "undefined") { return false; }
    if(handler == null || typeof handler !== "function") { return false; }
    this.routes.push({ "path" : path, "type" : type, "handler" : handler, "middleware": middleware });
    return true;
  }

  APIModule.prototype.addListener = function (message_key, handler) {
    console.log(
      "Adding Listener", message_key, this.socket_listeners.length
    );
    if(message_key == "" || typeof message_key == "undefined") { return false; }
    if(handler == null || typeof handler !== "function") { return false; }
    this.socket_listeners.push({"message_key" : message_key, "handler" : handler });
    return true;
  }

  APIModule.prototype.registerRoutes = function (app) {
    if(typeof app == "undefined") { return false; }
    if(this.routes.length < 1) { return false; }
    this.routes.forEach(function (route, index, sourceArray) {
      console.log("Registering Route "+route.type+" : ", route.path);
      switch(route.type) {
        case "get" : { if(route.middleware) { app.get(route.path, route.middleware, route.handler); } else { app.get(route.path, route.handler); } } break;
        case "post" : { if(route.middleware) { app.post(route.path, route.middleware, route.handler); } else { app.post(route.path, route.handler); } } break;
        case "put" : { if(route.middleware) { app.put(route.path, route.middleware, route.handler); } else { app.put(route.path, route.handler); } } break;
        case "patch" : { if(route.middleware) { app.patch(route.path, route.middleware, route.handler); } else { app.patch(route.path, route.handler); } } break;
        case "delete" : { if(route.middleware) { app.delete(route.path, route.middleware, route.handler); } else { app.delete(route.path, route.handler); } } break;
        default : {} break;
      }
    });
  };

  APIModule.prototype.registerListeners = function (socket) {
    if(typeof socket == "undefined") { return false; }
    if(this.socket_listeners.length < 1) { return false; }
    this.socket_listeners.forEach(function (listener, index, sourceArray) {
      console.log("Registering Socket Listener : ", listener.message_key);
      socket.on(listener.message_key, function (message) {
        listener.handler(socket, message);
      });
    });
  };

  APIModule.prototype.deregisterListeners = function (socket) {
    if(typeof socket == "undefined") { return false; }
    if(this.socket_listeners.length < 1) { return false; }
    this.socket_listeners.forEach(function (listener, index, sourceArray) {
      console.log("Deregistering Socket Listener : ", listener.message_key);
      socket.removeListener(listener.message_key, function (message) {
        listener.handler(socket, message);
      });
    });
  };

  module.exports = function () { return new APIModule(); };
})();
