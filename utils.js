function chooseServer(serversInfo) {
    while(true) {
      let choosenServer = Math.floor(Math.random() *  serversInfo.length);
      if (serversInfo[choosenServer].status === "UP")
        return choosenServer;
    }
  }

  function hashCode(hasheable) {
    let hash = 0;
    if (hasheable.length === 0) {
      return hash;
    }
    for (let i = 0; i < hasheable.length; i++) {
      const char = hasheable.charCodeAt(i);
      hash = (hash << 5) - hash + char;
    }
    return Math.abs(hash);
  };

  function unixTimestamp (date = Date.now()) {  
    return Math.floor(date / 1000)
  }

  module.exports = {
    chooseServer,
    hashCode,
    unixTimestamp
  };