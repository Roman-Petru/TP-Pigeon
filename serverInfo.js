const axios = require('axios');

class ServerInfo{
    constructor(hostname, port, serverNumber, status) {
        this.hostname = hostname;
        this.port = port;
        this.serverNumber = serverNumber;
        this.status = status;
    }
}

const serversInfo = [];
const users = [];
const conversations = [];

let serverNumber;

function assignServerNumber(number) {
    serverNumber = number;
}

function getServerNumber() {
    return serverNumber;
}

function putServerDown(number) {
  const serverToChange = serversInfo[number];
  serverToChange.status = "DOWN";
}

function putServerUp(number) {
  const serverToChange = serversInfo[number];
  serverToChange.status = "UP";
}

function getMetaInformation(){
  const metaInfo = {
      servers_list: serversInfo,
      users_list: users,
      conversations_list: conversations
    }
  return metaInfo;
}

function notifyAllServers(type, content, exceptionServer) {
  const serversToSend = serversInfo.filter(server => exceptionServer != server.serverNumber && getServerNumber() != server.serverNumber)
  const serversUp = serversToSend.filter(server => server.status === "UP")

  serversUp.forEach(server => {

      const url = 'http://' + server.hostname + ':' + server.port + '/notification';
      const requestBody = {
          type: type,
          content: content,
      };

      console.log("Notifiyng server number ", server.serverNumber);
      console.log("New content: ", JSON.stringify(requestBody));
    
      axios.post(url, requestBody).then(response => {
        console.log("Notification sent succesfully to server number ", server.serverNumber, ", response: ", response.data);
      })
      .catch(err => {
          console.log(err);
          console.log("Server error trying to notify, putting it down and sending it to other servers");
          putServerDown(server.serverNumber)
          notifyAllServers("serverDown", server.serverNumber, server.serverNumber)
      });

  })
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

      const searchServer = serversInfo.find((s) => s.hostname === hostname && s.port === port);

      if (searchServer) {
        searchServer.status = "UP";
      } else {
        const newServer = new ServerInfo(hostname, port, serversInfo.length, "UP");
        serversInfo.push(newServer);
        notifyAllServers("newServer", newServer, newServer.serverNumber);
      }
  
      const responseBody = getMetaInformation();
  
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
    });
  }

  function handleNotification(req, res) {
    let data = '';
  
    req.on('data', (chunk) => {
      data += chunk;
    });
  
    req.on('end', () => {
      const requestData = JSON.parse(data);
      const { type, content } = requestData;
  
      console.log('New notification content: ', data);
  
      if (type === "newUser") {
        users.push(content);
      } else if (type === "newServer") {
        serversInfo.push(content);
      } else if (type === "newConversation") {
        conversations.push(content);
      } else if (type === "serverDown") {
        putServerDown(content)
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not known type');
      }
  
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Notification update');
  
    });
  }
  
  

module.exports = {
    ServerInfo,
    serversInfo,
    users,
    conversations,
    assignServerNumber,
    getServerNumber,
    putServerDown,
    putServerUp,
    notifyAllServers,
    handleNotification,
    handleNewServer
  };