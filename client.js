const http = require('http');

// Define the server's hostname and port
const hostname = '127.0.0.1';  // Replace with your server's hostname
const port = 3000;            // Replace with your server's port

// Create an options object for the request
const options = {
  hostname,
  port,
  path: '/',
  method: 'GET',
};


function getIndex() {
    try {
        const req = http.request(options, (res) => {
            let data = '';
          
            // Receive and process the response data
            res.on('data', (chunk) => {
              data += chunk;
            });
          
            // Handle the response when it's complete
            res.on('end', () => {
              console.log('Server Response:');
              console.log(data);
            });
          });
  
    // Handle errors
    req.on('error', (error) => {
        console.error('Error:', error);
    });
    
    // End the request
    req.end();
    // Read user input from the console and make a request based on the input

    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function readCommand() {
    readline.question('Enter a command (e.g., "getIndex" or "exit"): ', (command) => {
      if (command === 'getIndex') {
        getIndex();
      } else if (command === 'exit') {
        console.log('Exiting app.');
        readline.close();
      } else {
        console.log('Invalid command.');
      }
      readCommand();
    });
  }
  
  readCommand();
