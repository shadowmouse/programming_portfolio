
// Function Shamelessly Lifted from https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
let randomString = function(length) {
	let text = "";
	let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for(let i = 0; i < length; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
/*
This class is an in memory event bus system. Instances are used all over the app
to handle messaging instead of a single message bus with topics. Exists mostly because
I didn't want to figure out Redux at the same time as I was learning React itself.
*/
class Eventer {

	constructor(identifier, options) {
		this.prefix = identifier;
		if(typeof identifier == "undefined" || identifier === "") { this.prefix = randomString(10); }
		this._registeredListeners = {};
		this._linkedBuses = {};
		this._instanceID = 0;
		this._debug = false;
		if (typeof options !== "undefined" && options.debug === true) { this._debug = true; }
		this.notifyListeners = this.notifyListeners.bind(this);
		this.notifyLinkedBuses = this.notifyLinkedBuses.bind(this);
		this.registerListener = this.registerListener.bind(this);
		this.deregisterListener = this.deregisterListener.bind(this);
		this.deregisterAll = this.deregisterAll.bind(this);
		this.notify = this.notify.bind(this);
		this.getListeners = this.getListeners.bind(this);
		this.getPrefix = this.getPrefix.bind(this);
		this.addLinkedBus = this.addLinkedBus.bind(this);
		this.clearLinkedBuses = this.clearLinkedBuses.bind(this);
		this.getLinkedBuses = this.getLinkedBuses.bind(this)
	}

	notifyLinkedBuses(action, payload) {
		for (let key in this._linkedBuses) {
			let b = this._linkedBuses[key];
			if (typeof b.filter == "function") {
				if (b.filter(action, payload)) {
					if (typeof b.mutator == "function") {
						let results = b.mutator(action, payload);
						b.bus.notifyListeners(results.action, results.payload);
					} else {
						b.bus.notifyListeners(action, payload);
					}
				}
			} else {
				bus.notifyListeners(action, payload);
			}
		}
	}

	notifyListeners(action, payload) {
		for (let key in this._registeredListeners) {
			let listener = this._registeredListeners[key];
			if(this._debug) { console.log("Eventer Listener Notify", key, listener); console.trace(); }
			if(action == listener.action) {
				if(typeof listener.callback == "function") {
					listener.callback(payload, action);
				}
			}
		}
		this.notifyLinkedBuses(action, payload);
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
		if(this._debug) { console.log("Eventer Listener Registration", listenerKey); console.trace(); }
		return listenerKey;
	}

	on(action, callback) {
		return registerListener(action, callback)
	}

	deregisterListener(deregister_id) {
		if(this._debug) { console.log("Eventer Deregister", deregister_id); console.trace(); }
		delete this._registeredListeners[deregister_id];
		return false;
	}

	deregisterAll() {
		if(this._debug) { console.log("Eventer Deregister All"); console.trace(); }
		this._registeredListeners = {};
	}

	notify(action, payload) {
		if(this._debug) { console.log("Eventer Notification", action, payload); console.trace(); }
		this.notifyListeners(action, payload);
	}

	getPrefix() {
		return this.prefix;
	}	

	getListeners() {
		return this._registeredListeners;
	}

	addLinkedBus(bus, filter, mutator) {
		let bus_prefix = bus.getPrefix();
		this._linkedBuses[bus_prefix] = { bus: bus, filter: filter, mutator: mutator };
	}

	removeLinkedBus(bus) {
		let bus_prefix = bus.getPrefix();
		delete this._linkedBuses[bus_prefix];
	}

	clearLinkedBuses() {
		this._linkedBuses = {};
	}

	getLinkedBuses() {
		return this._linkedBuses.map((b) => { return b.bus; });
	}
};

export default {
	createBus : function (identifier, options) {
		return new Eventer(identifier, options);
	}
}
