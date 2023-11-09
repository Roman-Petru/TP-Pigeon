const http = require('http');
const fs = require('fs');
const inquirer = require('inquirer');
const axios = require('axios');
const { User, users, createUser } = require('./users');
const { ServerInfo, serversInfo } = require('./serverInfo');
const { chooseServer, hashCode } = require('./utils');


function handleLoginRequest(req, res) {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    const requestData = JSON.parse(data);
    const { username, password } = requestData;

    const hashedPassword = hashCode(password);
    console.log('users: ', users);
    console.log('username: ', username, 'password: ', hashedPassword);

    const user = users.find((u) => u.username === username && u.password === hashedPassword);
    if (user) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Login successful!\n');
    } else {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Login failed. Invalid username or password.\n');
    }
  });
}

function handleAddUserRequest(req, res) {

  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    const requestData = JSON.parse(data);
    const { username, password } = requestData;

    const userExists = users.some((user) => user.username === username);

    if (userExists) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('User already exists.\n');
    } else {
      createUser(username, password, chooseServer(username, serversInfo.length));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('User created.\n');
    }
  });
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

    const newServer = new ServerInfo(hostname, port, serversInfo.length, "OK");
    serversInfo.push(newServer);

    const responseBody = {
      servers_list: serversInfo,
      users_list: users
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseBody));

  });
}

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


function startServer(config) {
  const server = http.createServer((req, res) => {

    console.log('New request to: ', req.url);
  
    //ROUTER
    if (req.method === 'GET' && req.url === '/login') {
      handleLoginRequest(req, res);
    } else if (req.method === 'POST' && req.url === '/addUser') {
      handleAddUserRequest(req, res);
    } else if (req.method === 'PATCH' && req.url === '/newServer') {
      handleNewServer(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found\n');
    }
  });

  server.listen(config.port, config.hostname, () => {
    console.log(`Server is running at http://${config.hostname}:${config.port}/`);
  });
  
  if (config.firstServer === true) {
    const newServer = new ServerInfo(config.hostname, config.port, 0, "OK");
    serversInfo.push(newServer);
    createUser("root", "root", 0)
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
    })
    .catch(err => {
      console.log(err);
    });
  }
}

