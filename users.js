const { hashCode } = require('./utils');

class User {
    constructor(username, password, inServer) {
      this.username = username;
      this.password = password;
      this.inServer = inServer;
    }

    changePassword(newPassword) {
        this.password = hashCode(newPassword);
        console.log(`${this.username}'s password has been updated.`);
      }
}

const users = [];

function createUser(username, password, serverNumber) {
    const newUser = new User(username, hashCode(password), serverNumber);
    users.push(newUser);
    console.log(`User ${username} added.`);
}

module.exports = {
    User,
    users,
    createUser
  };