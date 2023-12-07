const axios = require('axios');
const { unixTimestamp } = require('./utils');

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
let conversations = [];

let serverNumber;

function changeConversations(newConversations) {
  conversations = newConversations;
}

function assignServerNumber(number) {
    serverNumber = number;
}

function getServerNumber() {
    return serverNumber;
}

function getReplicateServerNumber(number) {
  let toInt = parseInt(number);
  if (serversInfo.length <= toInt + 1) {
    return 0;
  } else return (toInt + 1);
}

function isServerDown(number) {
  return serversInfo[number].status === "DOWN";
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
  const convMetaInf = conversations.map(conv => ({ ...conv, messages: [] }));

  const metaInfo = {
      servers_list: serversInfo,
      users_list: users,
      conversations_list: convMetaInf
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
      let needRestore;

      if (searchServer) {
        searchServer.status = "DOWN";
        if (!isServerDown(getReplicateServerNumber(searchServer.serverNumber))) {
          needRestore = true;
        }
      } else {
        const newServer = new ServerInfo(hostname, port, serversInfo.length, "DOWN");
        serversInfo.push(newServer);
        notifyAllServers("newServer", newServer, newServer.serverNumber);
        needRestore = false;
      }
  
      let responseBody = getMetaInformation();
      responseBody.need_restore = needRestore;
  
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
      } else if (type === "newAdmin") {

        const requestData = JSON.parse(data);
        const { convId, userAddingAdmin, newAdminUsername } = requestData.content;
        const conversation = conversations.find((c) => c.id === convId);
        const user = users.find((u) => u.username === newAdminUsername);

        conversation.admins.push(user);
        conversation.last_modified = unixTimestamp();

      } else if (type === "newUserInConv") {

        const requestData = JSON.parse(data);
        const { convId, adminAddingUser, newUserUsername } = requestData.content;
        const conversation = conversations.find((c) => c.id === convId);
        const user = users.find((u) => u.username === newUserUsername);

        conversation.users.push(user);
        conversation.last_modified = unixTimestamp();

      } else if (type === "deleteUserInConv") {

        const requestData = JSON.parse(data);
        const { convId, adminDeletingUser, deletedUserUsername } = requestData.content;
        const conversation = conversations.find((c) => c.id === convId);

        conversation.users = conversation.users.filter(user => user.username !== deletedUserUsername)
        conversation.admins = conversation.admins.filter(admin => admin.username !== deletedUserUsername)
        conversation.last_modified = unixTimestamp();

      } else if (type === "addNotification") {

        const requestData = JSON.parse(data);
        const { username, convId } = requestData.content;

        const userToAdd = users.find((u) => u.username === username);
        userToAdd.pendingNotifications.push(convId);

      } else if (type === "emptyNotifications") {

        const requestData = JSON.parse(data);
        const { username } = requestData.content;

        const user = users.find((u) => u.username === username);
        user.pendingNotifications = [];

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
    changeConversations,
    getMetaInformation,
    assignServerNumber,
    getServerNumber,
    getReplicateServerNumber,
    isServerDown,
    putServerDown,
    putServerUp,
    notifyAllServers,
    handleNotification,
    handleNewServer
  };