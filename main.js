"use strict";

/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");

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
    }

    async _createDeviceFromConfig(deviceId, device) {
        const nativeTemplate = {
            "ip":     device.ip,
            "port":   device.port,
            "addr":   device.addr,
            "group": 0,
            "motor": 0
        };
        const deviceTemplate = {
            "name":   device.name,
            "role":   "blind",
            "desc":   "Tronferno device"
        };
        await this.createDeviceAsync(deviceId, deviceTemplate, nativeTemplate);
        // Make all 7 Groups and 7 Motors for Device
        // TODO: Special Group 0 and Motors 0 to address all Groups / Motors in Group
        for (let g=1;g<8;g++){
            nativeTemplate.group = g;
            nativeTemplate.motor = 0; // reset to 0 for every iretation
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
                const motorName = "level" + m.toString();
                await this.createStateAsync(deviceId, channelName, motorName, stateTemplate, nativeTemplate);
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
                "role": "info."
            },
            "native":{
                "ip":     device.ip,
                "port":   device.port
            }
        });
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //this.log.info("config option1: " + this.config.devices);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        
        await this.setObjectAsync("testVariable", {
            type: "state",
            common: {
                name: "testVariable",
                type: "boolean",
                role: "indicator",
                read: true,
                write: true,
            },
            native: {},
        });
        */
        // in this template all states changes inside the adapters namespace are subscribed
        //this.subscribeStates("*");
        /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync("testVariable", true);
        
        let saveConfig = false; // Flag if Config save is needed

        this.log.info("config: " + this.config)
        // No Devices in Config -> Nothing to do -> disable Adapter
        /* if (this.config.devices === undefined) {
            this.disable();
            return;
        }*/
        
        // Create flaged Devices in Config
        this.config.devices.forEach( (device, idx) => {
            if (device.create) {
                this.log.info("Create Device " + device.name);
                this._createDeviceFromConfig("Device" + idx, device);
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

        this.subscribeForeignStates("*.level*");


    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
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
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
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