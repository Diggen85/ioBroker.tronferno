/* eslint-disable no-var */

var net = require("net");
var server = net.createServer(function(connection) { 
    console.log("client connected from IP" + connection.address.toString() );
   
    connection.on("end", function() {
        console.log("client disconnected");
    });

    connection.on("data", function (data) {
        console.log("Received: " + data );
    });

    connection.write("Hello from Testserver");
    // Echo mode
    connection.pipe(connection);
});

server.listen(7777, function() { 
    console.log("Testserver Port 7777");
});
