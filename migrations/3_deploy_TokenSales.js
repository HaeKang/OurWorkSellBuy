const TestToken = artifacts.require('./TestToken.sol')
const TokenSales = artifacts.require('./TokenSales.sol')
const fs = require('fs')

module.exports = function (deployer) {

    //TokenSales contract을 배포할것이다, TestToken address는 tokensales 컨트렉의 생성자 인자
  deployer.deploy(TokenSales, TestToken.address)    
    .then(() => {
      if (TokenSales._json) {
        fs.writeFile(
          'deployedABI_TokenSales',
          JSON.stringify(TokenSales._json.abi),
          (err) => {
            if (err) throw err
            console.log("파일에 ABI 입력 성공");
          })
      }

      fs.writeFile(
        'deployedAddress_TokenSales',
        TokenSales.address,
        (err) => {
          if (err) throw err
          console.log("파일에 주소 입력 성공");
        })
    })
}