/*

    Created By : Elliot Francis
    Date : Oct 23, 2017
    Description : A event bus manager module for managing multiple Eventer buses

*/

class BusManager {
  constructor () {
      this._responders = []
      this.add = this.add.bind(this)
      this.clear = this.clear.bind(this)
  }

  add (actionKey, dataSource) {
    this._responders.push({'actionKey' : actionKey, 'source' : dataSource});
  }

  clear () {
    this._responders.map(function (responder) {
      let dataSource = responder.source;
      dataSource.deregisterListener(responder.actionKey);
    })
    this._responders = [];
  }

}

module.exports = function () { return new BusManager(); }
