const axios = require('axios');
const { serversInfo, conversations, users , getServerNumber, putServerDown, putServerUp, getReplicateServerNumber } = require('./serverInfo');

function checkServerHealth() {
    const serversToSend = serversInfo.filter(server => getServerNumber() != server.serverNumber)
  
    serversToSend.forEach(server => {
  
        const url = 'http://' + server.hostname + ':' + server.port + '/heartbeat';
  
        axios.get(url).then(() => {
            if (server.status === "DOWN") {
                putServerUp(server.serverNumber);
                console.log("Server number ", server.serverNumber, " with heartbeat OK, changed status to UP");
                mergeStateFromPartitionedServer(server);
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

function mergeStateFromPartitionedServer(server){
    const urlServerInfo = 'http://' + server.hostname + ':' + server.port + '/getServerInfo';
    const serverNumber = getServerNumber();
    const isReplicateServer = getReplicateServerNumber(serverNumber) === server.serverNumber;
    
    console.log("Mergin state from ", server)
    //Busco la metainfo (usuarios y conversaciones)
    axios.get(urlServerInfo).then((res) => {
            const data = res.data;
            console.log("Data to merge ", data);
            //filtro nuevos usuarios
            const newUsers = data.users_list.filter(user => !users.some(_user => _user.username === user.username));
            users.push(newUsers);
            
            //filtro nuevas convers
            const newConvers = data.conversations_list.filter(
                conver => !conversations.some(_conver => _conver.id === conver.id)
            );
            conversations.push(newConvers)
            
            conversations = conversations.map(conver => {
                const converReplica = data.conversations_list.find(_conver => _conver.id === conver.id);

                if(!converReplica || conver.last_modified >= converReplica.last_modified)
                {
                    return conver;
                }
                else
                {
                    converReplica.messages = conver.messages;
                    return converReplica;
                }
            });

            //si no es la replica, termino
            if(!isReplicateServer)
                return;
            
            //si es la replica, entonces busco las convers que tengo que hacer update
            const conversToUpdate = conversations.filter(
                conver => conver.inServer === serverNumber
            );
            
            const urlGetConversation = 'http://' + server.hostname + ':' + server.port + '/getConversation';
            
            //voy a buscar los mensajes de las conver que tengo que hacer update
            //TODO: ver de mejorar esto, quiza tambien se puede filtrar por timestamp los mensajes envez de traer todos
            conversToUpdate.forEach(conver => {
                axios.get(urlGetConversation+`?id=${conver.id}`).then((res) => {
                    //los nuevos mensajes son los nuevos ids
                    const newMessages = res.data.filter(message => 
                        !conver.messages.some(_message => _message.id === message.id)
                    );
                    conver.messages.push(newMessages);
                })
                .catch(err => {
                    console.log(err);
                    console.log("Server number ", server.serverNumber, " throwed error while fetching conver ", conver.id);
                });
            })

        })
        .catch(err => {
            console.log(err);
            if (server.status === "UP") {
                putServerDown(server.serverNumber)
                console.log("Server number ", server.serverNumber, " throwed error while merging, changed status to DOWN");
            }
        });
}

module.exports = {
    checkServerHealth,
    mergeStateFromPartitionedServer
  };