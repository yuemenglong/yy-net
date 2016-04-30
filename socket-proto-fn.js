var Buf = require("../yy-buf");
var Exception = require("../lib/Exception");
var Promise = require("bluebird");

var SOCKET_TIMEOUT_ERROR = "SOCKET_TIMEOUT_ERROR";
var SOCKET_ERROR = "SOCKET_ERROR";

function createReadFn(fnName, n) {
    return function() {
        if (this._readBuf.length() >= n) {
            return Promise.resolve(this._readBuf[fnName]());
        }
        if (this._close) {
            return Promise.resolve(undefined);
            // return Promise.reject(new Exception(SOCKET_ERROR, "Read End Socket"));
        }
        var that = this;
        return new Promise(function(resolve, reject) {
            that._data_handler = function(data) {
                if (that._readBuf.length() < n) {
                    that._data_handler = arguments.callee;
                } else {
                    resolve(that._readBuf[fnName]());
                }
            }
            that._close_handler = function() {
                resolve(undefined);
            }
            that._error_handler = function(err) {
                reject(err);
            }
            that._timeout_handler = function() {
                reject(new Exception(SOCKET_TIMEOUT_ERROR, "Read Timeout"));
            }
            that.socket.setTimeout(that._timeout);
        }).finally(function() {
            that._data_handler = null;
            that._close_handler = null;
            that._timeout_handler = null;
            that._error_handler = null;
        });
    }
}

function createWriteFn(fnName, n) {
    return function(value) {
        if (this._close) {
            throw new Exception(SOCKET_ERROR, "Write End Socket");
        }
        var that = this;
        if (value !== undefined) {
            this._writeBuf[fnName](value);
        }
        return this;
    }
}

function readUntil(sep) {
    var ret = this._readBuf.readUntil(sep);
    if (ret) {
        return Promise.resolve(ret);
    }
    if (this._close) {
        return Promise.resolve(undefined);
        // return Promise.reject(new Exception(SOCKET_ERROR, "Read End Socket"));
    }
    var that = this;
    return new Promise(function(resolve, reject) {
        that._data_handler = function(data) {
            if (data.indexOf(sep) < 0) {
                that._data_handler = arguments.callee;
            } else {
                resolve(that._readBuf.readUntil(sep));
            }
        }
        that._close_handler = function() {
            resolve(undefined);
        }
        that._error_handler = function(err) {
            reject(err);
        }
        that._timeout_handler = function() {
            reject(new Exception(SOCKET_TIMEOUT_ERROR, "Read Timeout"));
        }
        that.socket.setTimeout(that._timeout);
    }).finally(function() {
        that._data_handler = null;
        that._close_handler = null;
        that._timeout_handler = null;
        that._error_handler = null;
    });
}

function readLine() {
    return this.readUntil("\n");
}

function readString() {
    return this.readUntil(0);
}

function writeLine(str) {
    return this.write(str + "\n");
}

function writeString(str) {
    return this.write(str).writeInt8(0);
}

function socketProtoFn(proto) {
    for (var type in Buf.ENDIAN_TYPE) {
        var length = Buf.ENDIAN_TYPE[type];
        var fnName = `read${type}`;
        proto[fnName] = createReadFn(fnName, length);
        var fnName = `write${type}`;
        proto[fnName] = createWriteFn(fnName, length);
    }
    for (var type in Buf.NO_ENDIAN_TYPE) {
        var length = Buf.ENDIAN_TYPE[type];
        var fnName = `read${type}`;
        proto[fnName] = createReadFn(fnName, length);
        var fnName = `write${type}`;
        proto[fnName] = createWriteFn(fnName, length);
    }
    proto.readUntil = readUntil;
    proto.readLine = readLine;
    proto.writeLine = writeLine;
    proto.readString = readString;
    proto.writeString = writeString;
}

module.exports = socketProtoFn;
