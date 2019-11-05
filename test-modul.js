
// eslint-disable no-var
const net = require("net");

const server = net.createServer((connection) => { 
    console.log("client connected from IP" );
    connection.on("end", function() {
        console.log("client disconnected");
    });
    connection.on("data", function (data) {
        console.log("Received: " + data );
    });
    connection.write("Hello from Testserver");
    // Echo mode
    //connection.pipe(connection);
    newFunction();
});

server.on("error", (error) => {
    console.log("server error" + error);
});

// tronferno 
const tronfernoDev = require("./lib/tronfernoDev");

const dev = new tronfernoDev("123456", "192.168.178.51:7777");
dev.on("error", (error) => {
    console.info(error);
});
dev.on("connected", () => {
    console.info("Test connected");
    console.info(dev.isConnected);
    console.info(dev.isDisconnected);
    console.info(dev.isReconnecting);
});


server.listen(7777, () => { 
    console.log("Testserver Port 7777");
});
dev.connect();

function newFunction() {
    console.log("dev connected ? - " + dev.isConnected);
}
