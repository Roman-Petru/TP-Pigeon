const axios = require('axios');
const { serversInfo, getServerNumber, putServerDown, putServerUp } = require('./serverInfo');


function checkServerHealth() {
    const serversToSend = serversInfo.filter(server => getServerNumber() != server.serverNumber)
  
    serversToSend.forEach(server => {
  
        const url = 'http://' + server.hostname + ':' + server.port + '/heartbeat';
  
        axios.get(url).then(() => {
            if (server.status === "DOWN") {
                putServerUp(server.serverNumber);
                console.log("Server number ", server.serverNumber, " with heartbeat OK, changed status to UP");
            }
        })
        .catch(err => {
            if (server.status === "UP") {
                putServerDown(server.serverNumber)
                console.log("Server number ", server.serverNumber, " with heartbeat DOWN, changed status to DOWN");
            }
        });
  
    })
}

module.exports = {
    checkServerHealth
  };