const { Conversation, findConversation } = require('./conversation');

class Message {
    constructor(id, sender, message) {
      this.id = id;
      this.sender = sender;
      this.message = message;
      this.visibility = true;
      this.time = new Date();
    }

    changeVisibility() {
        this.visibility = !this.visibility;
      }
}

function createMessage(conversation, sender, message) {
    let messageId;
    if (conversation.messages.length === 0) {
        messageId = conversation.id + "ms" + 0;
    } else {
        let lastMessageId = conversation.messages[conversation.messages.length - 1].id;
        let indexOfMs = lastMessageId.indexOf("ms");
        let substringAfterMs = lastMessageId.substring(indexOfMs + 2);

        let lastIdNumber = parseInt(substringAfterMs);
        lastIdNumber = lastIdNumber + 1;
        messageId = conversation.id + "ms" + lastIdNumber;
    }

    const newMessage = new Message(messageId, sender, message);
    conversation.messages.push(newMessage);
    console.log(`Message "${newMessage.message}" with id ${messageId} added to the conversation ${conversation.id} at ${newMessage.time}.`);
}

function handleNewMessage(req, res) {
    let data = '';
  
    req.on('data', (chunk) => {
      data += chunk;
    });
  
    req.on('end', () => {
      const requestData = JSON.parse(data);
      const { conversationId, sender, message } = requestData;

      const conversation = findConversation(conversationId);

      if (conversation) {
        createMessage(conversation, sender, message)
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Message saved successfully!\n');
      } else {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Conversation not found.\n');
      }

    });
  }
  
  
  module.exports = {
    handleNewMessage
  };
  