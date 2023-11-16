const { hashCode } = require('./utils');
const { users, notifyAllServers } = require('./serverInfo');

class User {
    constructor(username, password) {
      this.username = username;
      this.password = password;
    }

    changePassword(newPassword) {
        this.password = hashCode(newPassword);
        console.log(`${this.username}'s password has been updated.`);
      }
}

function createUser(username, password) {
    const newUser = new User(username, hashCode(password));
    users.push(newUser);
    console.log(`User ${username} added.`);
    notifyAllServers("newUser", newUser, -1);
}

function findUser(username) {
  return users.find((u) => u.username === username);
}

function handleAddUserRequest(req, res) {

  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    const requestData = JSON.parse(data);
    const { username, password} = requestData;

    const userExists = users.some((user) => user.username === username);

    if (userExists) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('User already exists.\n');
    } else {
      createUser(username, password);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('User created.\n');
    }
  });
}

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

module.exports = {
    User,
    createUser,
    findUser,
    handleAddUserRequest,
    handleLoginRequest
  };