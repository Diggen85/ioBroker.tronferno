"use strict"

const Net = require("net");


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
*/

/**
 * Class to control Transferno Device
 * @class {string} addr
 */
class Tronferno {
    static CMD = {UP:1, DOWN:2, STOP:3};
	static STATE = {DISCONNECTED:1, CONNECTED:2, RECONNECTING:3};
    /**
     * 
     * @param {string} addr 
     */
    constructor(addr) {
		super();
		// some Private vars
		this._addr;
		this._port;
		this._state = this.STATE.DISCONNECTED;
		this._socket;
		
		//split addr
		if ( addr.includes(":") ) {
			this._addr = addr.split(":")[0];
			this._port = addr.split(":")[0];
			
			this._socket = new Net.Socket();
			
		} else {
			throw( new Error("Expected addr as HOST:PORT") );
		}


	}
	/**
	 * true for established connection
	 */
	get isConnected() {
		return this._state = this.STATE.CONNECTED ? true : false;
	}
		/**
	 * true for established connection
	 */
	get isDisconnected() {
		return this._state = this.STATE.DISCONNECTED ? true : false;
	}
	get isReconnecting() {
		return this.RECONNECTING = this.STATE.DISCONNECTED ? true : false;
	}

	get getState() {
		return this._state;
	}


	/**
	 * 
	 * @param {string} cmd 
	 */
	 _rawCmd(cmd) {
		
	}

	    /**
     *  Send cmd for tronferno devce
     *  @param {string}
     * 
     */
    async _sendCommand(deviceId, addr, group, motor, val) {
        //TODO: level based on time for up / down
       
        // if val is string convet to int
        if (typeof val === 'string') val = parseInt(val);
       
        // Level   0-49 = down
        // Level     50 = sun-down
        // Level 51-100 = up
        let cmd = "";       
        if (val < 50) {
            cmd="down";
        } else if (val == 50) {
            cmd="sun-down";
        } else if (val > 50) {
            cmd="up";
        } else return false;
        const tronfernoCmd = "send a="+addr+" g="+group+" m="+motor+" c="+cmd+";";

        return this._tronfernoRawCmd(deviceId, tronfernoCmd); 
	}
	
	_tronfernoRawCmd(deviceId, cmd) {
        this.log.info( deviceId + " -> " + cmd);
        if (this._tronfernoSockets.get(deviceId).writable) {
            //socker.write returns true if write to buffer was ok
            return this._tronfernoSockets.get(deviceId).write(cmd);
        } else {
            return false;
        }
	}
	
	async _connectTronferno(deviceId, ip, port) {
        //let deviceId = device.native.deviceId.toString(); // creates a new string in the actual scope for the async callbacks...
                
        const socket = new net.Socket();
        // donot delay - we have only short Packets
        socket.setNoDelay(true);
        socket.setEncoding("utf8");
        socket.on("connect", () => {
            this.log.info(deviceId + " connected");
            this.setState(deviceId + ".connected", true, true);
        });
        socket.on("error", (error) => {
            this.setState(deviceId + ".connected", false, false);
            this.log.info(deviceId + " error: " + error.toString());
        });
        socket.on("close", (hadError) => {
            // for close with error, error event sets state
            if (!hadError) { // without error ack -> no handling by iobroker state change event
                this.setState(deviceId + ".connected", false, true);
                this.log.info(deviceId + " disconnected, error: " + hadError.toString() );
            }
        });
        socket.on("end", () => {
            this.setState(deviceId + ".connected", false, false);
            this.log.info(deviceId + " disconnected by remote");
            // iobroker statechange Event reconnects
            socket.end();
        });
        // Maybe for the Future
        socket.on("data", (data) => {
            if (typeof data === "string") {
                this.log.info(deviceId + " received: " + data);
            } else {
                this.log.info(deviceId + " received: Non-String Value");
            }
        });
        // connect & Save to SocketMap
        if (this._tronfernoSockets.has(deviceId)) {
            //socket exists -> wait for reconnect
            this.log.info( deviceId + " is reconnecting in 5 sec")
            const timeout = setTimeout( () => {
                this._tronfernoSockets.set(deviceId, socket.connect(port, ip));
            }, 5000);
            this._tronfernoSockets.set(deviceId, timeout); //set Timeout as flag that reconnect is in progress
        } else {
            //connect directly
            this._tronfernoSockets.set(deviceId, socket.connect(port, ip));
        }
        
    }
}