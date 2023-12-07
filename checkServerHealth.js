const axios = require('axios');
const { serversInfo, conversations, users , changeConversations, getServerNumber, putServerDown, putServerUp, getReplicateServerNumber } = require('./serverInfo');

function mergeStateFromPartitionedServer(server){
    const urlServerInfo = 'http://' + server.hostname + ':' + server.port + '/getServerInfo';
    const serverNumber = getServerNumber();
    const isReplicateServer = getReplicateServerNumber(serverNumber) == server.serverNumber;
    const iAmTheReplicaServer = getReplicateServerNumber(server.serverNumber) == serverNumber;
    
    console.log("Mergin state from ", server)
    //Busco la metainfo (usuarios y conversaciones)
    axios.get(urlServerInfo).then((res) => {
            const data = res.data;
            //filtro nuevos usuarios
            const newUsers = data.users_list.filter(user => !users.some(_user => _user.username === user.username));
            console.log("Merging from Server number ", server.serverNumber," - New users: ", newUsers);
            users.push(...newUsers);
                        
            //filtro nuevas convers
            const newConvers = data.conversations_list.filter(
                conver => !conversations.some(_conver => _conver.id === conver.id)
            );

            console.log("Merging from Server number ", server.serverNumber," - New conversations: ", newConvers);
            conversations.push(...newConvers)
            
            let newConversations = conversations.map(conver => {
                let converReplica = data.conversations_list.find(_conver => _conver.id === conver.id);

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

            changeConversations(newConversations);

            //si no es la replica y yo no soy la replica, termino
            
            console.log("Merging from Server number ", server.serverNumber," - isReplicateServer: ", isReplicateServer, " - iAmTheReplicaServer: ", iAmTheReplicaServer);
            if(!isReplicateServer && !iAmTheReplicaServer)
                return;
            
            //si es la replica o soy la replica, entonces busco las convers que tengo que hacer update
            let conversToUpdate = conversations.filter(
                conver => conver.inServer === serverNumber || getReplicateServerNumber(conver.inServer) === serverNumber
            );

            console.log("Merging from Server number ", server.serverNumber," - Conversations to update: ", JSON.stringify(conversToUpdate));
            
            const urlGetConversation = 'http://' + server.hostname + ':' + server.port + '/getConversation';
            
            //voy a buscar los mensajes de las conver que tengo que hacer update
            //TODO: ver de mejorar esto, quiza tambien se puede filtrar por timestamp los mensajes envez de traer todos
            conversToUpdate.forEach(conver => {
                axios.get(urlGetConversation+`?id=${conver.id}`).then((res) => {
                    //los nuevos mensajes son los nuevos ids
                    const newMessages = res.data.filter(message => 
                        !conver.messages.some(_message => _message.id === message.id)
                    );
                    console.log("Merging from Server number ", server.serverNumber," - Conversations to update messages: ", conver.id, " - new Messages: ", newMessages);
                    conver.messages.push(...newMessages);
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
    mergeStateFromPartitionedServer
  };