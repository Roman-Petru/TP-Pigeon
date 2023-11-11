const http = require('http');
const fs = require('fs');
const inquirer = require('inquirer');
const axios = require('axios');
const { User, users, createUser, handleAddUserRequest, handleLoginRequest } = require('./users');
const { ServerInfo, serversInfo, serverNumber, assignServerNumber, handleNewServer } = require('./serverInfo');
const { handleNewConversation, handleGetConversation, handleGetAllConversations } = require('./Conversation/conversation');
const { handleNewMessage } = require('./Conversation/message');
const { chooseServer, hashCode } = require('./utils');

function startServer(config) {
  const server = http.createServer((req, res) => {

    console.log('New request to: ', req.url);
  
    //------------------ROUTER--------------------

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST' && req.url === '/login') {
      handleLoginRequest(req, res);
    } else if (req.method === 'POST' && req.url === '/addUser') {
      handleAddUserRequest(req, res);
    } else if (req.method === 'PATCH' && req.url === '/newServer') {
      handleNewServer(req, res);
    } else if (req.method === 'POST' && req.url === '/newConversation') {
      handleNewConversation(req, res);
    } else if (req.method === 'PATCH' && req.url === '/newMessage') {
      handleNewMessage(req, res);
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
    const newServer = new ServerInfo(config.hostname, config.port, 0, "OK", true);
    serversInfo.push(newServer);
    assignServerNumber(0);
  } else {
    //syncNewServer()
    const url = 'http://' + config.contactPointHost + ':' + config.contactPointPort + '/newServer';
    const requestBody = {
      hostname: config.hostname,
      port: config.port,
    };
  
    axios.patch(url, requestBody).then(response => {
      console.log(response.data);
      users.push(...response.data.users_list);
      serversInfo.push(...response.data.servers_list);
      serverNumber = response.data.servers_list.length - 1;
      console.log('Server number: ', serverNumber);
    })
    .catch(err => {
      console.log(err);
    });
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
  
    const config = require(`./${configFileName}`);
    startServer(config);
  });
});