const HDWalletProvider = require("truffle-hdwallet-provider-klaytn");
const NETWORK_ID = '1001'
const GASLIMIT = '20000000'
const URL = `https://api.baobab.klaytn.net:8651`
const PRIVATE_KEY = '0x04d3278bd11e1e577804f5841968e359ec95c9226fce9d79e09876f6a953ce85'

module.exports = {
  networks: {  
    ganache: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // Match any network id 
    },

     klaytn: {
       provider: new HDWalletProvider(PRIVATE_KEY, URL),
       network_id: NETWORK_ID,
       gas: GASLIMIT,
       gasPrice: null,
     }  
  }
}