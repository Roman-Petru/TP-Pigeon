const http = require('http');
const fs = require('fs');
const inquirer = require('inquirer');
const axios = require('axios');
const { handleAddUserRequest, handleLoginRequest } = require('./users');
const { ServerInfo, serversInfo, users, conversations, assignServerNumber, getServerNumber, handleNotification, handleNewServer, getReplicateServerNumber } = require('./serverInfo');
const { handleNewConversation, handleGetConversation, handleGetAllConversations } = require('./Conversation/conversation');
const { handleNewMessage, handleReplicateMessage } = require('./Conversation/message');
const { checkServerHealth } = require('./checkServerHealth');

function startServer(config) {
  const server = http.createServer((req, res) => {

    if (req.url !== '/heartbeat') {
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serversInfo));
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
    } else if (req.method === 'PATCH' && req.url === '/replicateMessage') {
      handleReplicateMessage(req, res);
    } else if (req.method === 'GET' && req.url.startsWith('/getConversation')) {
      handleGetConversation(req, res);
    } else if (req.method === 'GET' && req.url.startsWith('/getAllConversations')) {
      handleGetAllConversations(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found\n');
    }
  });

  server.listen(config.port, config.hostname, () => {
    console.log(`Server is running at http://${config.hostname}:${config.port}/`);
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
      assignServerNumber(searchServer.serverNumber);
      console.log('Server number assigned: ', getServerNumber());

      if (response.data.need_restore) {
        
        conversationsToRestore = conversations.filter(conv => conv.inServer == getServerNumber());
        const serverToFetch = getReplicateServerNumber(getServerNumber());
        console.log('Server need restoring, proceeding to fetch conversations from replica server number: ', serverToFetch);

        const url = 'http://' + serversInfo[serverToFetch].hostname + ':' + serversInfo[serverToFetch].port + '/getConversation?id=';
        conversationsToRestore.forEach(conv => {
          const getUrl = url + conv.id;
          axios.get(getUrl).then(response => {
            console.log('Succesfuly got data from conversation ', conv.id);
            console.log(response.data);
            conv.messages.push(...response.data)
            })
            .catch(err => {
              console.log('Error fetching conversation ', conv.id ,' from replica server.');
              console.log(err);
            });
            })
      }
      
    })
    .catch(err => {
      console.log(err);
    });
  }
  setInterval(checkServerHealth, 1000);
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
  
    const config = require(`./${configFileName}`);
    startServer(config);
  });
});