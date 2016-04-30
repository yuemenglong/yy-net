var should = require("should");

var Server = require("../server");
var Socket = require("../socket");

var PORT = 8001;

function fail() {
    should(false).eql(true);
}

var echoServer = new Server();

before(function() {
    function accept(server) {
        return server.accept().then(function(socket) {
            echo(socket).catch().done();
            return accept(server);
        });
    }

    function echo(socket) {
        return socket.read(1).then(function(res) {
            if (res === undefined) {
                return socket.close();
            } else {
                return socket.flush(res).catch(function(err) {

                }).then(function() {
                    return echo(socket);
                });
            }
        })
    }

    echoServer.listen(PORT).then(function() {
        accept(echoServer).done();
    }).done();
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
        }).then(function() {
            fail();
        }).catch(function(err) {
            // logger.log(err);
            done();
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
            socket.close().catch(function(err) {
                // logger.log(err);
            }).done();
            return socket.flush("hello");
        }).then(function() {
            fail();
        }).catch(function(err) {
            // logger.error(err);
            done();
        }).done(function() {

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
            done();
        }).done(function() {});
    });
});
