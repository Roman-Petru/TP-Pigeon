const { Conversation, findConversation } = require('./conversation');
const { serversInfo, getServerNumber, putServerDown, isServerDown, notifyAllServers, getReplicateServerNumber } = require('../serverInfo');
const axios = require('axios');
const { generateGUID, unixTimestamp } = require('../utils');

class Message {
    constructor(id, sender, message, secondsForVisibility) {
      this.id = id;
      this.sender = sender;
      this.message = message;
      this.time = new Date();

      let currentDate = new Date();
      currentDate.setSeconds(currentDate.getSeconds() + secondsForVisibility);

      this.visibility = currentDate;
    }
}

function createMessage(conversation, sender, message, secondsForVisibility) {
    const messageId = generateGUID();

    const newMessage = new Message(messageId, sender, message, secondsForVisibility);
    conversation.messages.push(newMessage);
    conversation.last_modified = unixTimestamp();
    console.log(`Message "${newMessage.message}" with id ${messageId} added to the conversation ${conversation.id} at ${newMessage.time}.`);
    return newMessage;
}

function notifyNewMessage(serverNumber, requestData) {

  const url = 'http://' + serversInfo[serverNumber].hostname + ':' + serversInfo[serverNumber].port + '/newMessage';

  console.log("Notifiyng server number ", serverNumber);
  console.log("New message: ", JSON.stringify(requestData));

  axios.patch(url, requestData).then(response => {
    console.log("Message sent, response: ", response.data);
  })
  .catch(err => {
      console.log(err);
      console.log("Server error trying to send message, putting it down and sending it to other servers");
      putServerDown(serverNumber)
      notifyAllServers("serverDown", serverNumber, serverNumber)
  });
}

function replicateNewMessage(conversationId, newMessage) {

  const serverToReplicate = getReplicateServerNumber(getServerNumber());
  const url = 'http://' + serversInfo[serverToReplicate].hostname + ':' + serversInfo[serverToReplicate].port + '/replicateMessage';

  console.log("Replicating to server number ", serverToReplicate);

  const infoToReplicate = {
    conversationId: conversationId,
    message: newMessage
  }

  axios.patch(url, infoToReplicate).then(response => {
    console.log("Message sent, response: ", response.data);
  })
  .catch(err => {
      console.log(err);
      console.log("Server error trying to send message, putting it down and sending it to other servers");
      putServerDown(serverToReplicate)
      notifyAllServers("serverDown", serverToReplicate, serverToReplicate)
  });
}

function handleNewMessage(req, res) {
    let data = '';
  
    req.on('data', (chunk) => {
      data += chunk;
    });
  
    req.on('end', () => {
      const requestData = JSON.parse(data);
      const { conversationId, sender, message, secondsForVisibility } = requestData;

      const conversation = findConversation(conversationId);

      if (conversation) {
        if (conversation.inServer === getServerNumber()) {
          const newMessage = createMessage(conversation, sender, message, secondsForVisibility)
          replicateNewMessage(conversationId, newMessage);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Message saved successfully!\n');
        } else {
          // si el server que tiene la conversacion esta caido le mando a la replica, excepto que estes parado en la replica
          if (isServerDown(conversation.inServer)) {
            if (getServerNumber() === getReplicateServerNumber(conversation.inServer)) {
              const newMessage = createMessage(conversation, sender, message, secondsForVisibility)
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('Message saved successfully!\n');
            } else {
              notifyNewMessage(getReplicateServerNumber(conversation.inServer), requestData)
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('Message saved successfully!\n');
            }
          } else { // El server donde va el mensaje esta UP, se manda a ese server
            notifyNewMessage(conversation.inServer, requestData)
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Message saved successfully!\n');
          }
        }
      } else {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Conversation not found.\n');
      }

    });
  }

function handleReplicateMessage(req, res) {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    const requestData = JSON.parse(data);
    const { conversationId, message } = requestData;

    const conversation = findConversation(conversationId);

    if (conversation) {

      conversation.messages.push(message);
      conversation.last_modified = unixTimestamp();
      console.log(`For replication: Message "${message.message}" with id ${message.id} added to the conversation ${conversation.id} at ${message.time}.`);

    } else {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Conversation not found.\n');
    }
  });
}
  
  
  module.exports = {
    handleNewMessage,
    handleReplicateMessage
  };
  