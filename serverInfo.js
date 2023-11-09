class ServerInfo{
    constructor(hostname, port, serverNumber, status) {
        this.hostname = hostname;
        this.port = port;
        this.serverNumber = serverNumber;
        this.status = status;
    }
}

const serversInfo = [];

module.exports = {
    ServerInfo,
    serversInfo,
  };