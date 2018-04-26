/*

    Created By : Elliot Francis
    Date : Jun 22, 2016
    Description : An event bus module for handling event bus style communication in React and React Native Projects

*/

// Function Shamelessly Lifted from https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
let randomString = function(length) {
		let text = "";
		let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		for(let i = 0; i < length; i++) {
				text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
}

class Eventer {

  constructor(identifier) {
    this.prefix = identifier;
  	if(typeof identifier == "undefined" || identifier === "") { this.prefix = randomString(10); }
  	this._registeredListeners = {};
  	this._instanceID = 0;

    this.notifyListeners = this.notifyListeners.bind(this);
    this.registerListener = this.registerListener.bind(this);
    this.deregisterListener = this.deregisterListener.bind(this);
    this.deregisterAll = this.deregisterAll.bind(this);
    this.notify = this.notify.bind(this);
  }

	notifyListeners(action, payload) {
		for (let key in this._registeredListeners) {
			let listener = this._registeredListeners[key];
			if(action == listener.action) {
				if(typeof listener.callback == "function") {
					listener.callback(payload, action);
				}
			}
		}
	}

	registerListener(action, callback) {
		let listener = {
			action : action,
			callback : callback,
			id: this._instanceID
		};

		let listenerKey = this.prefix + "_" + listener.id;
		this._registeredListeners[listenerKey] = listener;
		this._instanceID += 1;
		return listenerKey;
	}

	deregisterListener(deregister_id) {
		delete this._registeredListeners[deregister_id];
 		return false;
	}

	deregisterAll() {
		this._registeredListeners = {};
	}

	notify(action, payload) {
	   this.notifyListeners(action, payload);
	}
};

module.exports = {
	createBus : function (identifier) {
		return new Eventer(identifier);
	}
}
