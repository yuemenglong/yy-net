var should = require("should");
var co = require("co");

var Server = require("..").Server;
var Socket = require("..").Socket;

var PORT = 8001;

function fail() {
    should(false).eql(true);
}

var echoServer = new Server();

before(function() {
    co(function*() {
        yield echoServer.listen(PORT);
        while (true) {
            var socket = yield echoServer.accept();
            if (!socket) {
                break;
            }
            console.log("New Connection");
            while (true) {
                try {
                    var b = yield socket.read();
                    if (b === undefined) {
                        break;
                    }
                    console.log(b);
                    if (b.toString() === "q") {
                        yield socket.close();
                        break;
                    }
                    yield socket.flush(b);
                } catch (err) {
                    yield socket.close();
                    break;
                }
            }
            console.log("Connection Close");
        }
    });
})

after(function() {
    echoServer.close().done(function() {});
})


describe('Socket', function() {
    it('Basic', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.flush("hello");
        }).then(function() {
            return socket.read(5);
        }).then(function(res) {
            res.toString().should.eql("hello");
            return socket.close();
        }).done(function() {
            done();
        });
    });

    it('Close', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.flush("hello");
        }).then(function() {
            return socket.close();
        }).done(function() {
            done();
        });
    });
    it('Read', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.flush("he");
        }).then(function() {
            return socket.flush("ll");
        }).then(function() {
            return socket.flush("o\n");
        }).then(function() {
            return socket.read(5);
        }).then(function(res) {
            res.should.eql(new Buffer("hello"));
            return socket.read(1);
        }).then(function(res) {
            res.should.eql(new Buffer("\n"));
        }).then(function() {
            return socket.close();
        }).done(function() {
            done();
        });
    });
    it('Read After Close', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.close();
        }).then(function() {
            return socket.read();
        }).then(function(res) {
            should(res).eql(undefined);
            done();
        }).catch(function(err) {
            console.log(err);
            fail();
        }).done();
    });
    it('Read While Close', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            socket.close();
            return socket.read();
        }).then(function(res) {
            should(res).eql(undefined);
        }).done(function() {
            done();
        });
    });
    it('Write After Close', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.close();
        }).then(function() {
            return socket.flush("hello");
        }).then(function() {
            fail();
        }).catch(function(err) {
            done();
        }).done();
    });
    it('Write While Close', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.write("q").flush();
        }).then(function(res) {
            return socket.read();
        }).then(function(res) {
            should(res).eql(undefined);
            return socket.write("already close").flush();
        }).catch(function(err) {
            socket.close();
            done();
        });
    });
    it('Timeout', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            socket.setTimeout(100);
        }).then(function() {
            return socket.read(1);
        }).then(function() {
            fail();
        }).catch(function(err) {
            err.name.should.eql("SOCKET_TIMEOUT_ERROR");
        }).then(function() {
            return socket.read(1);
        }).then(function() {
            fail();
        }).catch(function(err) {
            err.name.should.eql("SOCKET_TIMEOUT_ERROR")
            socket.close();
            done();
        }).done(function() {});
    });
    it('Local Close And Reconnect', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.writeInt32(0x12345678).flush();
        }).then(function(res) {
            return socket.readInt32();
        }).then(function(res) {
            res.should.eql(0x12345678);
            return socket.close();
        }).then(function(res) {
            return socket.connect("localhost", PORT);
        }).then(function(res) {
            return socket.writeInt32(0x12345678).flush();
        }).then(function(res) {
            return socket.readInt32();
        }).then(function(res) {
            res.should.eql(0x12345678);
            return socket.close();
        }).done(function() {
            done();
        });
    });
    it('Line', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.writeLine("hello").flush();
        }).then(function(res) {
            return socket.readLine();
        }).then(function(res) {
            res.toString().should.eql("hello");
            return socket.close();
        }).done(function() {
            done();
        });
    });
    it('String', function(done) {
        var socket = new Socket();
        socket.connect("localhost", PORT).then(function() {
            return socket.writeString("hello").flush();
        }).then(function(res) {
            return socket.readString();
        }).then(function(res) {
            res.toString().should.eql("hello");
            return socket.close();
        }).done(function() {
            done();
        });
    });
});
