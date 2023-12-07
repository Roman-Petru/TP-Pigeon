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

      let currentDate = unixTimestamp();
      currentDate = currentDate + secondsForVisibility;

      this.visibility = currentDate;
    }
}

function createMessage(conversation, sender, message, secondsForVisibility) {
    const messageId = generateGUID();

    const newMessage = new Message(messageId, sender, message, secondsForVisibility);
    conversation.messages.push(newMessage);
    conversation.last_modified = unixTimestamp();
    console.log(`Message "${newMessage.message}" with id ${messageId} added to the conversation ${conversation.id} at ${newMessage.time}.`);
    console.log(conversation);
    return newMessage;
}

function notifyNewMessage(serverNumber, requestData) {

  const url = 'http://' + serversInfo[serverNumber].hostname + ':' + serversInfo[serverNumber].port + '/newMessage';

  console.log("Notifiyng server number ", serverNumber);
  console.log("New message: ", JSON.stringify(requestData));

  if(isServerDown(serverNumber))
  {
    console.log("Server ", serverNumber, " DOWN, not notifying.");
    return;
  }
  
  axios.patch(url, requestData).then(response => {
    console.log("Message sent, response: ", response.data);
  })
  .catch(err => {
      console.log(err);
  });
}

function notifyDeleteMessage(serverNumber, requestData) {

  const url = 'http://' + serversInfo[serverNumber].hostname + ':' + serversInfo[serverNumber].port + '/deleteMessage';

  console.log("Notifiyng server number ", serverNumber);
  console.log("Message to delete: ", JSON.stringify(requestData));

  if(isServerDown(serverNumber))
  {
    console.log("Server ", serverNumber, " DOWN, not notifying.");
    return;
  }

  axios.post(url, requestData).then(response => {
    console.log("Message deleted, response: ", response.data);
  })
  .catch(err => {
      console.log(err);
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

  if(isServerDown(serverToReplicate))
  {
    console.log("Servidor para replicar caido, no se replica el nuevo mensaje");
    return;
  }

  axios.patch(url, infoToReplicate).then(response => {
    console.log("Message sent, response: ", response.data);
  })
  .catch(err => {
      console.log(err);
  });
}

function replicateDeleteMessage(conversationId, messageId) {

  const serverToReplicate = getReplicateServerNumber(getServerNumber());
  const url = 'http://' + serversInfo[serverToReplicate].hostname + ':' + serversInfo[serverToReplicate].port + '/replicateDeleteMessage';

  const infoToReplicate = {
    conversationId: conversationId,
    messageId: messageId
  }

  if(isServerDown(serverToReplicate))
  {
    console.log("Servidor para replicar caido, no se replica el borrado de mensaje");
    return;
  }

  console.log("Replicating to server number ", serverToReplicate, " - Message to delete: ", infoToReplicate);

  axios.post(url, infoToReplicate).then(response => {
    console.log("Message deleted, response: ", response.data);
  })
  .catch(err => {
      console.log(err);
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

      console.log(message);
      conversation.messages.push(message);
      conversation.last_modified = unixTimestamp();
      console.log(`For replication: Message "${message.message}" with id ${message.id} added to the conversation ${conversation.id} at ${message.time}.`);
      console.log(JSON.stringify(conversation));
    } else {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Conversation not found.\n');
    }
  });
}

function handleReplicateDeleteMessage(req, res) {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    const requestData = JSON.parse(data);
    const { conversationId, messageId } = requestData;

    const conversation = findConversation(conversationId);

    if (conversation) {

      conversation.messages = conversation.messages.filter(msg => msg.id !== messageId);
      console.log(`For replication: Deleted message with id ${messageId} in the conversation ${conversation.id}.`);

    } else {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Conversation not found.\n');
    }
  });
}
  
function handleDeleteMessage(req, res) {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    const requestData = JSON.parse(data);
    const { conversationId, messageId } = requestData;

    const conversation = findConversation(conversationId);

    if (conversation) {
      if (conversation.inServer === getServerNumber()) {
        console.log(conversation.messages);
        conversation.messages = conversation.messages.filter(msg => msg.id !== messageId);
        console.log(conversation.messages);
        replicateDeleteMessage(conversationId, messageId);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Message deleted successfully!\n');
      } else {
        // si el server que tiene la conversacion esta caido le mando a la replica, excepto que estes parado en la replica
        if (isServerDown(conversation.inServer)) {
          if (getServerNumber() === getReplicateServerNumber(conversation.inServer)) {
            conversation.messages = conversation.messages.filter(msg => msg.id !== messageId);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Message deleted successfully!\n');
          } else {
            notifyDeleteMessage(getReplicateServerNumber(conversation.inServer), requestData);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Message deleted successfully!\n');
          }
        } else { // El server donde va el mensaje esta UP, se manda a ese server
          notifyDeleteMessage(conversation.inServer, requestData)
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Message deleted successfully!\n');
        }
      }
    } else {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Conversation not found.\n');
    }

  });
}
  
  module.exports = {
    handleNewMessage,
    handleReplicateMessage,
    handleDeleteMessage,
    handleReplicateDeleteMessage
  };
  