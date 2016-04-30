var net = require("net");
var Promise = require("bluebird");

var Socket = require("./socket");
var Queue = require("../yy-queue");
var Exception = require("../lib/exception");

var debug = console.log;

module.exports = Server;

function port(that) {
    return that.server.address() ?
        that.server.address().port : NaN;
}

function Server() {
    var that = this;
    this._queue = new Queue();
    this.server = net.createServer(function(socket) {
        var ret = new Socket(socket);
        that._queue.push(ret);
    });
    this._errorHandler = null;
    this.server.on("listening", function() {
        debug("[%d] Server On Listening", port(that));
    })
    this.server.on("error", function(err) {
        debug("[%d] Server On Error", port(that));
        var handler = this._errorHandler;
        this._errorHandler = null;
        if (handler) {
            handler(err);
        }
    })
    this.server.on("connection", function(socket) {
        debug("[%d, %d] Server On Connection", socket.localPort, socket.remotePort);
    })
    this.server.on("close", function() {
        debug("[%d] Server On Close", port(that));
        that.server.removeAllListeners();
    })
}

Server.prototype.listen = function(port) {
    var that = this;
    return new Promise(function(resolve, reject) {
        that.server.listen(port, function() {
            resolve();
        });
        that._errorHandler = function(err) {
            reject(err);
        }
    }).finally(function() {
        that._errorHandler = null;
    })
}

Server.prototype.accept = function() {
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
