const { ServerInfo, getServerNumber } = require('../serverInfo');
const { findUser } = require('../users');
const url = require('url');  // Import the url module
const querystring = require('querystring');

class Conversation {
    constructor(id, admin, inServer) {
      this.id = id;
      this.admin = admin;
      this.users = [];
      this.messages = [];
      this.inServer = inServer;

      console.log(`${this.admin.username} created conversation with id: ${this.id}.`);
    }

    addUser(user) {
        this.users.push(user);
        console.log(`${user.username} added to conversation with id: ${this.id}.`);
      }
}

class ConversationDTO {
  constructor(id, users) {
    this.id = id;
    this.users = users;
  }
}

var id = 0;

const conversations = [];

function findConversation(id) {
  return conversations.find((c) => c.id === id);
}

function findConversationByUsername(username) {
  return conversations.filter((c) => c.users.some(user => user.username === username));
}

function generateUniqueId() {
  id = id + 1;
  return getServerNumber() + "sv" + id;
}

function createConversation(fromUser, toUser) {
    const newId = generateUniqueId();
    const newConv = new Conversation(newId, fromUser, 0);
    newConv.addUser(fromUser);
    newConv.addUser(toUser);
    conversations.push(newConv);
    console.log('New conversation with id: ', newId, ', from user: ', fromUser.username, ', to user: ', toUser.username);
}

function handleNewConversation(req, res) {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    const requestData = JSON.parse(data);
    const { fromUsername, toUsername } = requestData;

    console.log(`New Conversation request body: ${data}`);

    const fromUser = findUser(fromUsername);
    const toUser = findUser(toUsername);

    if(fromUser && toUser) {

      createConversation(fromUser, toUser);
  
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('New conversation created!\n');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Invalid users.\n');
    }
  
  });
}


function handleGetConversation(req, res) {

  const parsedUrl = url.parse(req.url);
  const queryParams = querystring.parse(parsedUrl.query);

  const id = queryParams.id;

  const conversation = findConversation(id);

  if (conversation) {

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(conversation.messages));

  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Conversation not found.\n');
  }
}

function handleGetAllConversations(req, res) {

  const parsedUrl = url.parse(req.url);
  const queryParams = querystring.parse(parsedUrl.query);

  const username = queryParams.username;

  const conversationsOfUser = findConversationByUsername(username);

  if (conversationsOfUser) {

    const conversationsDTO = conversationsOfUser.map(conv => new ConversationDTO(conv.id, conv.users.filter(user => user.username != username).map(user => user.username)));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(conversationsDTO));

  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Conversations not found.\n');
  }
}

module.exports = {
  conversations,
  findConversation,
  handleNewConversation,
  handleGetConversation,
  handleGetAllConversations
};
