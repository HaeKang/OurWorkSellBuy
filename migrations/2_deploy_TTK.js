const TestToken = artifacts.require('./TestToken.sol')
const fs = require('fs')

module.exports = function (deployer) {
  var name = "TEST Token";
  var symbol = "TTK";

  deployer.deploy(TestToken, name, symbol)
    .then(() => {
      if (TestToken._json) {
        fs.writeFile(
          'deployedABI',
          JSON.stringify(TestToken._json.abi),
          (err) => {
            if (err) throw err
            console.log("파일에 ABI 입력 성공");
          })
      }

      fs.writeFile(
        'deployedAddress',
        TestToken.address,
        (err) => {
          if (err) throw err
          console.log("파일에 주소 입력 성공");
        })
    })
}