const http = require('http');
const fs = require('fs');
const inquirer = require('inquirer');
const axios = require('axios');
const { handleAddUserRequest, handleLoginRequest } = require('./users');
const { ServerInfo, serversInfo, users, conversations, getMetaInformation, assignServerNumber, getServerNumber, handleNotification, handleNewServer, getReplicateServerNumber } = require('./serverInfo');
const { handleNewConversation, handleGetConversation, handleGetAllConversations, handleAddAdmin, handleAddUserToConversation, handleDeleteUserFromConversation } = require('./Conversation/conversation');
const { handleNewMessage, handleReplicateMessage, handleDeleteMessage, handleReplicateDeleteMessage } = require('./Conversation/message');
const { mergeStateFromPartitionedServer } = require('./checkServerHealth');  
const { handleGetUserNotifications } = require('./notifications');
const { WebSocketServer, WebSocket } = require('ws')
const url = require('url');
const querystring = require('querystring');

var globalConfig = {};
const serversConnections = [];
const autoReconnectWebSocket = false;

class ServerConnection{
  constructor(serverInfo, ws){
    this.serverInfo = serverInfo;
    this.ws = ws;
  }
}

function handleCutConnection(req,res){
  const parsedUrl = url.parse(req.url);
  const queryParams = querystring.parse(parsedUrl.query);

  const serverNumber = queryParams.serverNumber;
  console.log(serversConnections);
  const serverConnection = serversConnections.find(sc => sc.serverInfo.serverNumber == serverNumber);
  serverConnection.ws.close();
  res.writeHead(200);
  res.end();  
}

function handleReconnect(req, res){
  const requestBody = {
    hostname: globalConfig.hostname,
    port: globalConfig.port,
    merge: true
  };
  serversInfo.filter(server => server.serverNumber !== getServerNumber() && server.status === "DOWN")
             .forEach(serverInfo => {
              console.log("[RECONNECTION] STARTING CONNECTION ", serverInfo);
              startWebSocketConnection(serverInfo, requestBody);
             });

  res.writeHead(200);
  res.end();
}

function startServer(config) {
  const server = http.createServer((req, res) => {

    if (req.url !== '/heartbeat' && req.url !== '/getServerInfo' && !req.url.startsWith('/getUserNotifications')) {
      console.log('New request to: ', req.url);
    }
  
    //------------------ROUTER--------------------

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PATCH, GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/heartbeat') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK!\n');
    } else if (req.method === 'GET' && req.url === '/getServerInfo') {
      const metaInfo = getMetaInformation();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metaInfo));
    } else if (req.method === 'POST' && req.url === '/login') {
      handleLoginRequest(req, res);
    } else if (req.method === 'POST' && req.url === '/addUser') {
      handleAddUserRequest(req, res);
    } else if (req.method === 'PATCH' && req.url === '/newServer') {
      handleNewServer(req, res);
    } else if (req.method === 'POST' && req.url === '/notification') {
      handleNotification(req, res);
    } else if (req.method === 'POST' && req.url === '/newConversation') {
      handleNewConversation(req, res);
    } else if (req.method === 'PATCH' && req.url === '/newMessage') {
      handleNewMessage(req, res);
    } else if (req.method === 'POST' && req.url === '/deleteMessage') {
      handleDeleteMessage(req, res);
    } else if (req.method === 'PATCH' && req.url === '/replicateMessage') {
      handleReplicateMessage(req, res);
    } else if (req.method === 'POST' && req.url === '/replicateDeleteMessage') {
      handleReplicateDeleteMessage(req, res);
    } else if (req.method === 'PATCH' && req.url === '/addAdmin') {
      handleAddAdmin(req, res);
    } else if (req.method === 'PATCH' && req.url === '/addUserToConv') {
      handleAddUserToConversation(req, res);
    } else if (req.method === 'PATCH' && req.url === '/deleteUserFromConv') {
      handleDeleteUserFromConversation(req, res);
    } else if (req.method === 'GET' && req.url.startsWith('/getConversation')) {
      handleGetConversation(req, res);
    } else if (req.method === 'GET' && req.url.startsWith('/getAllConversations')) {
      handleGetAllConversations(req, res);
    } else if (req.method === 'POST' && req.url.startsWith('/cutConnection')){
      handleCutConnection(req,res);
    } else if (req.method === 'POST' && req.url.startsWith('/reconnect')){
      handleReconnect(req,res);
    } else if (req.method === 'GET' && req.url.startsWith('/getUserNotifications')) {
      handleGetUserNotifications(req, res);
    } 
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found\n');
    }
  });

  server.listen(config.port, config.hostname, () => {
    console.log(`Server is running at http://${config.hostname}:${config.port}/`);
  });
  
  const wsServer = new WebSocketServer({
    server: server,
    autoAcceptConnections: false
  });

  wsServer.on('connection', function connection(ws) {
    console.log("[CONNECTION] SERVER CONNECTED");

    ws.on('message', function message(data){
      const {hostname, port, merge} = JSON.parse(data); 

      const serverInfo = serversInfo.find((s) => s.hostname === hostname && s.port === port);
      const serverConnection = serversConnections.find(sc => sc.serverInfo === serverInfo);
      console.log("[MESSAGE] SERVER UP", serverConnection?.serverInfo ?? serverInfo);
      serverInfo.status = "UP";
      if(serverConnection)
      {
        serverConnection.ws = ws;
      }
      else{
        serversConnections.push(new ServerConnection(serverInfo, ws));
      }
      
      if(merge)
        mergeStateFromPartitionedServer(serverInfo);
    });
    
    ws.on('error', function error(data) {
      //PUT SERVER DOWN
      const serverConnection = serversConnections.find(sc => sc.ws === ws);
      console.log("[ERROR] SERVER DOWN", serverConnection?.serverInfo);
      if(serverConnection)
      {
        serverConnection.serverInfo.status = "DOWN";
      }
      
      
    });

    ws.on('close', function close(data) {
      //PUT SERVER DOWN
      const serverConnection = serversConnections.find(sc => sc.ws === ws);
      console.log("[CLOSE] SERVER DOWN", serverConnection?.serverInfo);
      if(serverConnection)
      {
        serverConnection.serverInfo.status = "DOWN";
      }
    });

  });

  if (config.firstServer === true) {
    const newServer = new ServerInfo(config.hostname, config.port, 0, "UP");
    serversInfo.push(newServer);
    assignServerNumber(0);
    console.log('Server number assigned: ', getServerNumber());
  } else {
    
    const url = 'http://' + config.contactPointHost + ':' + config.contactPointPort + '/newServer';
    const requestBody = {
      hostname: config.hostname,
      port: config.port,
    };
  
    axios.patch(url, requestBody).then(response => {
      console.log(response.data);
      users.push(...response.data.users_list);
      serversInfo.push(...response.data.servers_list);
      conversations.push(...response.data.conversations_list)

      const searchServer = serversInfo.find((s) => s.hostname === config.hostname && s.port === config.port);
      searchServer.status = "UP";
      assignServerNumber(searchServer.serverNumber);
      console.log('[STARTING] Server number assigned: ', getServerNumber());

      if (response.data.need_restore) {
        
        conversationsToRestore = conversations.filter(conv => conv.inServer == getServerNumber());
        const serverToFetch = getReplicateServerNumber(getServerNumber());
        console.log('[STARTING] Server need restoring, proceeding to fetch conversations from replica server number: ', serverToFetch);

        const url = 'http://' + serversInfo[serverToFetch].hostname + ':' + serversInfo[serverToFetch].port + '/getConversation?id=';
        conversationsToRestore.forEach(conv => {
          const getUrl = url + conv.id;
          axios.get(getUrl).then(response => {
            console.log('[STARTING] Succesfuly got data from conversation ', conv.id);
            console.log(response.data);
            conv.messages.push(...response.data)
            })
            .catch(err => {
              console.log('[STARTING] Error fetching conversation ', conv.id ,' from replica server.');
              console.log(err);
            });
            })
      }
      console.log("[STARTING] SERVERS INFO",serversInfo);
      requestBody.merge = false;
      serversInfo.filter(server => server.serverNumber !== getServerNumber())
                 .forEach(serverInfo => startWebSocketConnection(serverInfo, requestBody));
    })
    .catch(err => {
      console.log(err);
    });
  }
}

function startWebSocketConnection(serverInfo, requestBody){
  const socket = new WebSocket(`ws://${serverInfo.hostname}:${serverInfo.port}`);
  console.log("[CONNECTING] STARTING CONNECTION ", serverInfo);
  
  socket.on('open', function open(data){
    console.log("[OPEN] SERVER UP", serverInfo);
    socket.send(JSON.stringify(requestBody));
    serverInfo.status = "UP";
    if(requestBody.merge)
      mergeStateFromPartitionedServer(serverInfo);
  })

  socket.on('error', function error(error) {
    console.log(error);
    const serverConnection = serversConnections.find(sc => sc.ws === socket);
    console.log("[ERROR] SERVER DOWN", serverConnection?.serverInfo);
    serverConnection.serverInfo.status = "DOWN";
  });

  socket.on('close', function close() {
    const serverConnection = serversConnections.find(sc => sc.ws === socket);
    console.log("[CLOSE] SERVER DOWN", serverConnection?.serverInfo);
    serverConnection.serverInfo.status = "DOWN";
  });

  const serverConnection = serversConnections.find(sc => sc.serverInfo === serverInfo); 
  if(serverConnection)
  {
    serverConnection.ws = socket;
  }
  else{
    serversConnections.push(new ServerConnection(serverInfo, socket));
  }
}

//---------LOAD CONFIG------

const folderPath = __dirname;
const regexPattern = /^config.*\.json$/;
const choices = [];

fs.readdir(folderPath, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    return;
  }

  files.forEach((file) => {
    if (regexPattern.test(file)) {
      console.log('Found matching file:', file);
      choices.push(file);
    }
  });

  const configOptions = [
    {
      type: 'list',
      name: 'selectedOption',
      message: 'Choose a config file:',
      choices: choices,
    },
  ];
  
  inquirer.prompt(configOptions).then((answers) => {
    const configFileName = answers.selectedOption;
    console.log(`You selected: ${configFileName}`);
  
    globalConfig = require(`./${configFileName}`);
    startServer(globalConfig);
  });
});