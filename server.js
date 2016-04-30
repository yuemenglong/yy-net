var net = require("net");
var Promise = require("bluebird");

var Socket = require("./socket");
var Queue = require("../yy-queue");
var Exception = require("../lib/exception");

module.exports = Server;

function port(that) {
    return that.server.address() ?
        that.server.address().port : NaN;
}

function Server() {}

Server.prototype._init = function() {
    var that = this;
    this._close = true;
    this._queue = new Queue();
    this.server = net.createServer(function(socket) {
        var ret = new Socket(socket);
        that._queue.push(ret);
    });
    this._errorHandler = null;
    this.server.on("connection", function(socket) {})
    this.server.on("listening", function() {
        that._close = false;
    })
    this.server.on("error", function(err) {
        var handler = that._errorHandler;
        that._errorHandler = null;
        if (handler) {
            handler(err);
        }
    })
    this.server.on("close", function() {
        that.server.removeAllListeners();
        that.server = null;
        that._close = true;
        that._queue.resolve(undefined);
    })
}

Server.prototype.listen = function(port) {
    if (!this.server) {
        this._init();
    }
    var that = this;
    return new Promise(function(resolve, reject) {
        that._errorHandler = function(err) {
            reject(err);
        }
        that.server.listen(port, function() {
            resolve();
        });
    }).finally(function() {
        that._errorHandler = null;
    })
}

Server.prototype.accept = function() {
    if (this._close) {
        return Promise.resolve(undefined);
    }
    return this._queue.pop();
}

Server.prototype.close = function() {
    var that = this;
    return new Promise(function(resolve, reject) {
        that.server.close(function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    });
}

if (require.main == module) {}
