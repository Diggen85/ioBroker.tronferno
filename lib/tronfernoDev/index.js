/*
	cmd.up=1
	cmd.down=2
	cmd.stop=3
	state.disconnected=1
	state.connected=2
	state.reconnecting=3
	constructor(addr:string)
	#addr
	#state
	#rawCmd(cmd:string)

get isConnected
get isReconnecting
get isDisconnected
get state
async cmdSendStart(g:num,m:num,cb(err)):bool
async cmdSendStop(g:num,m:num,cb(err)):bool
async cmdSendDown(g:num,m:num,cb(err)):bool

        if (this._tronfernoSockets.has(deviceId)) {
            //socket exists -> wait for reconnect
            this.log.info( deviceId + " is reconnecting in 5 sec")
            const timeout = setTimeout( () => {
                this._tronfernoSockets.set(deviceId, socket.connect(port, ip));
            }, 5000);
            this._tronfernoSockets.set(deviceId, timeout); //set Timeout as flag that reconnect is in progress
        } else {
            //connect directly

*/

const Net = require("net");
const Events = require("events");


/**
 * Class to control Transferno Device
 * @class {string} addr
 */
class TronfernoDev extends Events{
    /**
     * 
     * @param {string} ID
     * @param {string} addr 
     */
    constructor(id, addr) {
        super();
        // 
        this.CMD = {UP:1, DOWN:2, STOP:3};
        this.STATE = {DISCONNECTED:1, CONNECTED:2, RECONNECTING:3};
        // some Private vars
        this._id = id; 
        this._addr;
        this._ip;
        this._port;
        this._state = this.STATE.DISCONNECTED;
        this._error = false;
        this._socket;
        
        //split addr
        if ( addr.includes(":") ) {
            this._ip = addr.split(":")[0];
            this._port = addr.split(":")[1];
            this._socket = this._createIPSocket();
            // connect 
            //this._socket.connect(this._port, this._ip);
        } else {
            this._error = true;
            this.emit("error", "No IP:PORT");
        }
			

    }
    /**
	 * true for established connection
	 */
    get isConnected() {
        return this._state == this.STATE.CONNECTED ? true : false;
    }
    /**
	 * true for established connection
	 */
    get isDisconnected() {
        return this._state == this.STATE.DISCONNECTED ? true : false;
    }
    get isReconnecting() {
        return this.RECONNECTING == this.STATE.DISCONNECTED ? true : false;
    }

    get getState() {
        return this._state;
    }
    get getError() {
        return this._state;
    }
    /**
     * Connect Socket
     */
    connect() {
        console.info("Dev Connecting");
        this._socket.connect(this._port, this._ip);
        console.info("Dev Connecting done");
    }

    /**
	 * 
	 * @param {string} cmd 
	 */
    _rawCmd(cmd) {
        if (this._socket.isConnected()) {
            console.debug(cmd);
            this._socket.write(cmd);
        }   
    }

    /**
     *  Send cmd for tronferno devce
     *  @param {string}
     * 
     */
    async _sendCommand(group, motor, cmd) {
        if (this._socket.isConnected()){
            if (cmd == this.CMD.DOWN) {
                cmd="down";
            } else if (cmd == this.CMD.UP) {
                cmd="sup";
            } else if (cmd == this.CMD.STOP) {
                cmd="stop";
            } else {
                //return promise
                this.emit("error", TypeError("Command not known"));
                return false;
            }
            this._rawCmd("send a="+this._id+" g="+group+" m="+motor+" c="+cmd+";"); 
            //return promise...
            return true;
        } else {
            //return promise
            return false;
        }
    }
    
    /**
     * create Socket with configuration for transferno
     */
    _createIPSocket() {    
        const socket = new Net.Socket();
        // donot delay - we have only short Packets
        socket.setNoDelay(true);
        socket.setEncoding("utf8");
        socket.on("connect", () => {
            console.info("Dev connected");
            this._state = this.STATE.CONNECTED;
            this.emit("connected");
        });
        socket.on("error", (error) => {
            console.info("error: " + error.toString());
            this._error = true;
            this.emit("error", error);
        });
        socket.on("close", (hadError) => {
            if (!hadError) { 
                console.info("disconnected, error: " + hadError.toString() );
                this._error = true;
                this.emit("error", hadError);
            }
            this._state = this.STATE.DISCONNECTED;
 
        });
        socket.on("end", () => {
            //this.setState(deviceId + ".connected", false, false);
            console.info("disconnected by remote");
            this.emit("disconnected");
            this._state = this.STATE.DISCONNECTED;
        });

        return socket;
    }
}

module.exports = TronfernoDev;