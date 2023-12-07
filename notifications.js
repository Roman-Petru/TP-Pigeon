const { notifyAllServers } = require('./serverInfo');
const {findUser} = require('./users');
const url = require('url');
const querystring = require('querystring');

function addUserNotification(user, fromConversationId) {

    user.pendingNotifications.push(fromConversationId);
    const requestData = {
        username: user.username,
        convId: fromConversationId
    }

    console.log('Added notification for user: ', user);
    notifyAllServers("addNotification", requestData, -1)
  }
  
  function emptyNotifications(username) {
    const user = findUser(username);
    user.pendingNotifications = [];

    const requestData = {
        username: username
    }

    console.log('Emptied notifications for user ', username);
    notifyAllServers("emptyNotifications", requestData, -1)
  }

  function handleGetUserNotifications(req, res) {

    const parsedUrl = url.parse(req.url);
    const queryParams = querystring.parse(parsedUrl.query);
  
    const username = queryParams.username;
  
    const user = findUser(username);
  
    if (user) {
        if (user.pendingNotifications.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(user.pendingNotifications));
            emptyNotifications(username);
        } else {
            const emptyArray = [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(emptyArray));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('User not found.\n');
    }
  }

  module.exports = {
    addUserNotification,
    emptyNotifications,
    handleGetUserNotifications
  };