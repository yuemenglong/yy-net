var util = require("util");
var net = require("net");
var Promise = require("bluebird");

var Buf = require("yy-buf");
var Exception = require("yy-exception");

var socketProtoFn = require("./socket-proto-fn");

var SOCKET_TIMEOUT_ERROR = "SOCKET_TIMEOUT_ERROR";
var SOCKET_ERROR = "SOCKET_ERROR";

module.exports = Socket;

function Socket(socket) {
    if (!socket) {
        this._close = true;
        return;
    }
    this.socket = socket;
    this._close = false;
    this._init_event();
}

Socket.prototype._init = function() {
    this.socket = new net.Socket();
    this._close = true;
    this._init_event();
}

Socket.prototype._init_event = function() {
    var that = this;
    this._endian = this._endian || "BE";
    this._readBuf = new Buf(this._endian);
    this._writeBuf = new Buf(this._endian);
    this._timeout = 0;
    this._data_handler = null;
    this._error_handler = null;
    this._timeout_handler = null;
    this._close_handler = null;

    that.socket.on("error", function(err) {
        var handler = that._error_handler;
        that._error_handler = null;
        if (handler) {
            handler(err);
        }
    });

    that.socket.on("data", function(data) {
        that._readBuf.write(data);
        var handler = that._data_handler;
        that._data_handler = null;
        if (handler) {
            handler(data);
        }
    });

    that.socket.on("drain", function() {});

    that.socket.on("end", function() {});

    that.socket.on("connect", function() {
        that._close = false;
    });

    that.socket.on("close", function() {
        that.socket.removeAllListeners();
        that.socket = null;
        that._close = true;
        var handler = that._close_handler;
        that._close_handler = null;
        if (handler) {
            handler();
        }
    });

    that.socket.on("timeout", function() {
        var handler = that._timeout_handler;
        that._timeout_handler = null;
        if (handler) {
            handler();
        }
    })
}

Socket.prototype.setEndian = function(endian) {
    if (this._endian === endian) {
        return this;
    }
    this._endian = endian;
    this._readBuf = new Buf(endian);
    this._writeBuf = new Buf(endian);
    return this;
}

Socket.prototype.connect = function(host, port) {
    if (!this.socket) {
        this._init();
    }
    var that = this;
    return new Promise(function(resolve, reject) {
        that._error_handler = function(err) {
            reject(err);
        }
        that._timeout_handler = function() {
            reject(new Exception("SOCKET_TIMEOUT_ERROR",
                "Connect Timeout", that._timeout));
        }
        that.socket.setTimeout(that._timeout).connect({ host: host, port: port }, function() {
            resolve();
        });
    }).finally(function() {
        that._error_handler = null;
        that._timeout_handler = null;
    });
}

Socket.prototype.flush = function(data) {
    if (this._close) {
        return Promise.reject(new Exception(SOCKET_ERROR, "Write End Socket"));
    }
    var that = this;
    if (data) {
        this._writeBuf.write(data);
    }
    return new Promise(function(resolve, reject) {
        that._close_handler = function() {
            reject(new Exception(SOCKET_ERROR, "Socket Closed While Write"));
        }
        that._error_handler = function(err) {
            reject(err);
        }
        that._timeout_handler = function() {
            reject(new Exception(SOCKET_TIMEOUT_ERROR,
                "Write Timeout", that._timeout));
        }
        var buffer = that._writeBuf.buffer();
        that._writeBuf.clear();
        that.socket.setTimeout(that._timeout).write(buffer, function() {
            resolve();
        });
    }).finally(function() {
        that._error_handler = null;
        that._timeout_handler = null;
        that._close_handler = null;
    });
}

Socket.prototype.write = function(data) {
    if (this._close) {
        throw new Exception(SOCKET_ERROR, "Write End Socket");
    }
    var that = this;
    if (data !== undefined) {
        this._writeBuf.write(data);
    }
    return this;
}

Socket.prototype.read = function(n) {
    if (n === undefined) {
        n = 1;
    }
    if (this._readBuf.length() >= n) {
        return Promise.resolve(this._readBuf.read(n));
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
                resolve(that._readBuf.read(n));
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

Socket.prototype.close = function() {
    if (this._close) {
        return Promise.resolve();
    }
    var that = this;
    return new Promise(function(resolve, reject) {
        that._close_handler = function() {
            resolve();
        }
        that.socket.end();
    });
}

socketProtoFn(Socket.prototype);

Socket.prototype.setTimeout = function(ms) {
    this._timeout = ms;
}

Socket.prototype.on = function(event, cb) {
    this.socket.on(event, cb);
}

Socket.prototype.once = function(event, cb) {
    this.socket.once(event, cb);
}

if (require.main == module) {
    var socket = new Socket();
    Promise.try(function() {
        return socket.connect("localhost", 12345);
    }).then(function() {
        return socket.write("a").writeInt8(0).flush();
    }).then(function() {
        return socket.readUntil(0);
    }).then(function(res) {
        console.log(res);
        return socket.read(1);
    }).then(function(res) {
        console.log(res);
    })

}
