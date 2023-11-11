class ServerInfo{
    constructor(hostname, port, serverNumber, status, coordinator) {
        this.hostname = hostname;
        this.port = port;
        this.serverNumber = serverNumber;
        this.status = status;
        this.coordinator = coordinator;
    }
}

const serversInfo = [];
let serverNumber;

function assignServerNumber(number) {
    serverNumber = number;
}

function getServerNumber() {
    return serverNumber;
}

function handleNewServer(req, res) {
    let data = '';
  
    req.on('data', (chunk) => {
      data += chunk;
    });
  
    req.on('end', () => {
      const requestData = JSON.parse(data);
      const { hostname, port } = requestData;
  
      console.log('new hostname: ', hostname, 'new port: ', port);
  
      const newServer = new ServerInfo(hostname, port, serversInfo.length, "OK", false);
      serversInfo.push(newServer);
  
      const responseBody = {
        servers_list: serversInfo,
        users_list: users
      }
  
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
  
    });
  }
  

module.exports = {
    ServerInfo,
    serversInfo,
    serverNumber,
    assignServerNumber,
    getServerNumber,
    handleNewServer
  };