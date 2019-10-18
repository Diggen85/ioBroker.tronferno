declare let config: [{
    "name": string;
    "ip": string;
    "port": string;
    "addr": string;
    "create": boolean;
}];

declare let _tronfernoSockets: Map<string, Socket>;

declare function _sendCommand(ip: string, addr: string, group: string, motor:string): boolean;