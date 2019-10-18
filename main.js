"use strict";

/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");
const net = require("net");

class Tronferno extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "tronferno",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));

        //Map for holding _tronfernoDevice
        this._tronfernoSockets = new Map();
    }

    async _createDeviceFromConfig(deviceId, device) {
        const nativeDeviceTemplate = {
            "ip":     device.ip,
            "port":   device.port,
            "deviceId": this.namespace + "." + deviceId
        };
        const deviceTemplate = {
            "name":   device.name,
            "role":   "blind",
            "desc":   "Tronferno device"
        };
        await this.createDeviceAsync(deviceId, deviceTemplate, nativeDeviceTemplate);
        // Make all 7 Groups and 7 Motors for Device
        // TODO: Special Group 0 and Motors 0 to address all Groups / Motors in Group
        for (let g=1;g<8;g++){
            const nativeTemplate = {  //used in Group/Channel and Motor/State
                "addr":   device.addr,
                "group": g,
                "motor": 0,
                "deviceId": this.namespace + "." + deviceId
            };
            const groupTemplate = { 
                "name":  "Group " + g,      // mandatory, default _id ??
                "role":  "blind",            // optional   default undefined
                "desc":  "Gorup " + g       // optional,  default undefined
            };
            const channelName = "group" + g.toString();
            await this.createChannelAsync(deviceId, channelName, groupTemplate,nativeTemplate);

            for (let m=1; m<8;m++) {
                nativeTemplate.motor = m;
                const stateTemplate = {
                    "name":  "Motor "+m,         // mandatory, default _id ??
                    "def":   0,                      // optional,  default 0
                    "type":  "number",               // optional,  default "number"
                    "read":  true,                   // mandatory, default true
                    "write": true,                   // mandatory, default true
                    "min":   0,                      // optional,  default 0
                    "max":   100,                    // optional,  default 100
                    "unit":  "%",                    // optional,  default %
                    "role":  "level.blind",          // mandatory
                    "desc":  "Motor " + m + "level"  // optional,  default undefined
                };
                const stateName = "level" + m.toString();
                await this.createStateAsync(deviceId, channelName, stateName, stateTemplate, nativeTemplate);
            }
        }
        // Create Connected State for Device
        await this.setObjectAsync(deviceId + ".connected",{
            "type": "state",
            "common": {
                "name": "Info about connection to device",
                "type": "boolean",
                "read": true,
                "write": false,
                "def": false,
                "role": "indicator.reachable"
            },
            "native":{
                "ip":     device.ip,
                "port":   device.port,
                "deviceId": this.namespace + "." + deviceId
            }
        });
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

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        let saveConfig = false; // Flag if Config save is needed

        this.log.info("No of devices : " + this.config.devices.length.toString());
        
        // No Devices in Config -> Nothing to do -> disable Adapter
        if (this.config.devices.length == 0) {
            this.disable();
            return;
        }
        
        this.config.devices.forEach( async (device, idx) => {
            // Create flaged Devices in Config
            if (device.create) {
                this.log.info("Create Device " + device.name);
                await this._createDeviceFromConfig("device" + idx, device);
                // disable create in config array
                this.config.devices[idx].create = false;
                saveConfig = true;
            }
        });

        // if modified save config and restart
        if (saveConfig) {
            this.updateConfig(this.config);
            return;
        }

        // subscribe to connected States
        this.subscribeStates("*.connected");
        // Create Sockets for Devices
        this.getDevicesAsync().then( (devices) => {
            // Create Sockets for the Devices
            devices.forEach( (device) => {
                this._connectTronferno(device.native.deviceId, device.native.ip,  device.native.port);
            });
        });
        // Subscribe to level States
        this.subscribeStates("*.level*");
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.log.info("bye bye...");
            this._tronfernoSockets.forEach( (socket, id) => {
                //end Socket -> setsState .connected in event him self 
                socket.end();
                this.log.info("end Socket for " + id);

            });
            this.connected = false;
            this.log.info("bye bye...");
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        // if State was deleted -> exit
        if (!state )  {
            this.log.info(`state deleted)`);
            return;
        }
        // if state was acknowledged -> exit
        if(state.ack) {
            this.log.info(`state ${id} changed (ack = ${state.ack})`);
            return;
        }

        // get object from state
        const obj = await this.getObjectAsync(id).then( (obj) => { return obj || null ;});
        if (obj == null){ 
            this.log.info("Something went wrong with, obj null " + id);
            return;
        }
        // it could be the connected state
        if (id.endsWith("connected")) {
            if (state.val == false) {
                //Reconnect if Obj in Map is socket / on Reconnect its a timer
                const mapObj = this._tronfernoSockets.get(obj.native.deviceId);
                if ( mapObj instanceof net.Socket ) {
                    this._connectTronferno(obj.native.deviceId, obj.native.ip, obj.native.port);
                } else if ( mapObj instanceof setTimeout.prototype) {
                    this.log.info("Timer");
                }
            }
        } else { // it is a levelX state  //TODO: Check if its level
            // The state was changed -> send cmd and set ack         
            const cmdAck = await this._sendCommand(obj.native.deviceId, obj.native.addr, obj.native.group, obj.native.motor, state.val);
            if (cmdAck) {
                this.setState(id,state,true);
                this.log.info(`state ${id} acknowledged`);
            } else {
                this.log.info("Something went wrong with " + id );
            }
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Tronferno(options);
} else {
    // otherwise start the instance directly
    new Tronferno();
}