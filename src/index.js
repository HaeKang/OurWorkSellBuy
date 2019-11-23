import Caver from "caver-js";
import {
  Spinner
} from 'spin.js';


const config = {
  rpcURL: 'https://api.baobab.klaytn.net:8651'
}
const cav = new Caver(config.rpcURL);
const yttContract = new cav.klay.Contract(DEPLOYED_ABI, DEPLOYED_ADDRESS);
const tsContract = new cav.klay.Contract(DEPLOYED_ABI_TOKENSALES, DEPLOYED_ADDRESS_TOKENSALES);

var ipfsCilent = require('ipfs-http-client');
var ipfs = ipfsCilent({
  host: 'ipfs.infura.io',
  port: '5001',
  protocol: 'https'
});

const App = {
  auth: {
    accessType: 'keystore',
    keystore: '',
    password: ''
  },

  //#region 계정 인증

  start: async function () {
    const walletFromSession = sessionStorage.getItem('walletInstance');
    if (walletFromSession) {
      try {
        cav.klay.accounts.wallet.add(JSON.parse(walletFromSession));
        this.changeUI(JSON.parse(walletFromSession));
      } catch (e) {
        sessionStorage.removeItem('walletInstance');
      }
    }
  },

  handleImport: async function () {
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0]);
    fileReader.onload = (event) => {
      try {
        if (!this.checkValidKeystore(event.target.result)) {
          $('#message').text('유효하지 않은 keystore 파일입니다.');
          return;
        }
        this.auth.keystore = event.target.result;
        $('#message').text('keystore 통과. 비밀번호를 입력하세요.');
        document.querySelector('#input-password').focus();
      } catch (event) {
        $('#message').text('유효하지 않은 keystore 파일입니다.');
        return;
      }
    }
  },

  handlePassword: async function () {
    this.auth.password = event.target.value;
  },

  handleLogin: async function () {
    if (this.auth.accessType === 'keystore') {
      try {
        const privateKey = cav.klay.accounts.decrypt(this.auth.keystore, this.auth.password).privateKey;
        this.integrateWallet(privateKey);
      } catch (e) {
        $('#message').text('비밀번호가 일치하지 않습니다.');
      }
    }
  },

  handleLogout: async function () {
    this.removeWallet();
    location.reload();
  },

  getWallet: function () {
    if (cav.klay.accounts.wallet.length) {
      return cav.klay.accounts.wallet[0];
    }
  },

  checkValidKeystore: function (keystore) {
    const parsedKeystore = JSON.parse(keystore);
    const isValidKeystore = parsedKeystore.version &&
      parsedKeystore.id &&
      parsedKeystore.address &&
      parsedKeystore.crypto;

    return isValidKeystore;
  },

  integrateWallet: function (privateKey) {
    const walletInstance = cav.klay.accounts.privateKeyToAccount(privateKey);
    cav.klay.accounts.wallet.add(walletInstance)
    sessionStorage.setItem('walletInstance', JSON.stringify(walletInstance));
    this.changeUI(walletInstance);
  },

  reset: function () {
    this.auth = {
      keystore: '',
      password: ''
    };
  },

  changeUI: async function (walletInstance) {
    $('#loginModal').modal('hide');
    $("#login").hide();
    $('#logout').show();
    $('.afterLogin').show();
    $('#address').append('<br>' + '<p>' + '내 계정 주소: ' + walletInstance.address + '</p>');

    await this.displayMyTokensAndSale(walletInstance);
    await this.displayAllTokens(walletInstance);
    await this.checkApproval(walletInstance);
  },

  removeWallet: function () {
    cav.klay.accounts.wallet.clear();
    sessionStorage.removeItem('walletInstance');
    this.reset();
  },

  showSpinner: function () {
    var target = document.getElementById('spin');
    return new Spinner(opts).spin(target);
  },
  //#endregion

  checkTokenExists: async function () {
    var videoId = $('#video-id').val();
    var result = await this.isTokenAlreadyCreated(videoId);

    if (result) {
      $('#t-message').text('이미 토큰화된 썸네일 입니다.');
    } else {
      $('#t-message').text('토큰화 가능한 썸네일 입니다.');
      $('.btn-create').prop("disabled", false);
    }
  },

  createToken: async function () {
    var spinner = this.showSpinner();

    var videoId = $('#video-id').val();
    var title = $('#title').val();
    var author = $('#author').val();
    var dateCreated = $('#date-created').val();

    if (!videoId || !title || !author || !dateCreated) {
      // 값들이 제대로 입력 안되어있다면
      spinner.stop();
      alert(videoId + title + author + dateCreated);
      return;
    }

    try {
      // 값들이 제대로 왔다면 토큰발행
      const metaData = this.getERC721MetadataSchema(videoId, title, `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`)
      // metaData값을 json문자열로 변환하여 ipfs에 넣음
      var res = await ipfs.add(Buffer.from(JSON.stringify(metaData)));
      await this.mintYTT(videoId, author, dateCreated, res[0].hash);
    } catch (err) {
      console.error(err);
      spinner.stop();
    }
  },

  mintYTT: async function (videoId, author, dateCreated, hash) {

    // contract 계정이 gas비용 대납
    const sender = this.getWallet(); // 로그인한 사용자 정보
    const feePayer = cav.klay.accounts.wallet.add('0x04d3278bd11e1e577804f5841968e359ec95c9226fce9d79e09876f6a953ce85');

    // using the promise 트렌젝션에 서명
    const {
      rawTransaction: senderRawTransaction
    } = await cav.klay.accounts.signTransaction({
      type: 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION',
      from: sender.address,
      to: DEPLOYED_ADDRESS,
      data: yttContract.methods.mintYTT(videoId, author, dateCreated, "https://ipfs.infura.io/ipfs/" + hash).encodeABI(),
      gas: '500000',
      value: cav.utils.toPeb('0', 'KLAY'),
    }, sender.privateKey)

    cav.klay.sendTransaction({
        senderRawTransaction: senderRawTransaction,
        feePayer: feePayer.address,
      })
      .then(function (receipt) {
        if (receipt.transactionHash) {
          console.log("https://ipfs.infura.io/ipfs/" + hash);
          alert(receipt.transactionHash);
          location.reload();
        }
      });
  },

  displayMyTokensAndSale: async function (walletInstance) {
    // 계정이 보유한 토큰 개수
    var balance = parseInt(await this.getBalanceOf(walletInstance.address));

    if (balance == 0) {
      $('#myTokens').text("현재 보유한 토큰이 없습니다");
    } else {

      var isApproved = await this.isApprovedForAll(walletInstance.address, DEPLOYED_ADDRESS_TOKENSALES);


      // 내가 가진 토큰들 보여줌
      for (var i = 0; i < balance; i++) {
        (async () => {
          // tokenId 받아옴
          var tokenId = await this.getTokenOfOwnerByIndex(walletInstance.address, i);
          var tokenUri = await this.getTokenUri(tokenId);
          var ytt = await this.getYTT(tokenId);
          var metadata = await this.getMetadata(tokenUri);  
          var price = await this.getTokenPrice(tokenId);  // 소유자의 토큰 중 판매중인지 아닌지 price값을 통해 알아보자
          this.renderMyTokens(tokenId, ytt, metadata, isApproved, price);
         
          if(parseInt(price) > 0){
            // 0보다 크면 판매중인 토큰
            this.renderMyTokensSale(tokenId, ytt, metadata, price);
          }
        })();
      }
    }
  },

  displayAllTokens: async function (walletInstance) {
    var totalSupply = parseInt(await this.getTotalSupply());
    if (totalSupply === 0) {
      $('#allTokens').text("현재 발행된 토큰이 없습니다.");
    } else {
      for (var i = 0; i < totalSupply; i++) {
        (async () => {
          // tokenId 받아옴
          var tokenId = await this.getTokenByIndex(i);
          var tokenUri = await this.getTokenUri(tokenId); // token uri(infa였나 그거 주소 meta데이터 갖고있는 주소)
          var ytt = await this.getYTT(tokenId); // ytt 클래스
          var metadata = await this.getMetadata(tokenUri);  // meta데이터
          var price = await this.getTokenPrice(tokenId);  // 판매 가격
          var owner = await this.getOwnerOf(tokenId); // 토큰 소유자
          this.renderAllTokens(tokenId, ytt, metadata, price, owner, walletInstance);
        })();
      }
    }
  },

  renderMyTokens: function (tokenId, ytt, metadata, isApproved, price) {
    var tokens = $('#myTokens');
    var template = $('#MyTokensTemplate');

    this.getBasicTemplate(template, tokenId, ytt, metadata);

    // 판매 허락을 했다면
    if (isApproved) {
      //price에 값이 있으면 판매버튼 안보이게
      if(parseInt(price) > 0){
        template.find('.sell-token').hide();
      } else{
        template.find('.sell-token').show();
      }
    }

    tokens.append(template.html());
  },

  renderMyTokensSale: function (tokenId, ytt, metadata, price) {
    var tokens = $('#myTokensSale');
    var template = $('#MyTokensSaleTemplate');

    this.getBasicTemplate(template, tokenId, ytt, metadata);

    // cav.utils.fromPeb -> klay를 cav로 환산
    template.find('.on-sale').text(cav.utils.fromPeb(price,'KLAY') + "KLAY에 판매중");
    tokens.append(template.html());
  },

  renderAllTokens: function (tokenId, ytt, metadata, price, owner, walletInstance) {
    var tokens = $('#allTokens');
    var template = $('#AllTokensTemplate');

    this.getBasicTemplate(template, tokenId, ytt, metadata);

    // 토큰 구매 보이기
    if(parseInt(price) > 0){
      template.find('.buy-token').show();
      template.find('.token-price').text(cav.utils.fromPeb(price,'KLAY') + "KLAY에 판매중");
      
      // 로그인한 회원이 판매중인 토큰 주인이라면
      if(owner.toUpperCase() === walletInstance.address.toUpperCase()){
        template.find('.btn-buy').attr('disabled', true);
      }else{
        template.find('.btn-buy').attr('disabled', false);
      }

    } else{
      template.find('.buy-token').hide();
    }

    tokens.append(template.html());
  },

  approve: function () {
    this.showSpinner();
    const walletInstance = this.getWallet();

    // contract의 판매 권한 부여
    yttContract.methods.setApprovalForAll(DEPLOYED_ADDRESS_TOKENSALES, true).send({
      from: walletInstance.address,
      gas: '250000'
    }).then(function (receipt) {
      if (receipt.transactionHash) {
        location.reload(); // 페이지 새로고침
      }
    });
  },

  cancelApproval: async function () {
    this.showSpinner();
    const walletInstance = this.getWallet();

    // contract의 전송 권한 부여 취소
    const receipt = await yttContract.methods.setApprovalForAll(DEPLOYED_ADDRESS_TOKENSALES, false).send({
      from: walletInstance.address,
      gas: '250000'
    });

    if (receipt.transactionHash) {
      // 토큰 가격들 삭제
      await this.onCancelApprovalSuccess(walletInstance);
      location.reload(); // 페이지 새로고침
    }
  },

  // Approved 상태 확인
  checkApproval: async function (walletInstance) {
    var isApproved = await this.isApprovedForAll(walletInstance.address, DEPLOYED_ADDRESS_TOKENSALES);
    if (isApproved) { // isApproved가 true면 판매상태(권한이 있는 상태)
      $('#approve').hide();
    } else {
      $('#cancelApproval').hide();
    }
  },

  sellToken: async function (button) {
    var divInfo = $(button).closest('.panel-primary');
    var tokenId = divInfo.find('.panel-heading').text();
    var price = divInfo.find('.amount').val();

    // 가격이 0, 0이하면 함수 종료
    if (price <= 0) {
      return;
    }

    // 대납
    try {
      var spinner = this.showSpinner();
      // contract 계정이 gas비용 대납
      const sender = this.getWallet(); // 로그인한 사용자 정보
      const feePayer = cav.klay.accounts.wallet.add('0x04d3278bd11e1e577804f5841968e359ec95c9226fce9d79e09876f6a953ce85');

      // using the promise 트렌젝션에 서명
      const { rawTransaction: senderRawTransaction } = await cav.klay.accounts.signTransaction({
        type: 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION',
        from: sender.address,
        to: DEPLOYED_ADDRESS_TOKENSALES,  // TOKENSALSE 컨트렉으로 보냄
        data: tsContract.methods.setForSale(tokenId, cav.utils.toPeb(price, 'KLAY')).encodeABI(),
        gas: '500000',
        value: cav.utils.toPeb('0', 'KLAY'),
      }, sender.privateKey)

      cav.klay.sendTransaction({
          senderRawTransaction: senderRawTransaction,
          feePayer: feePayer.address,
        })
        .then(function (receipt) {
          if (receipt.transactionHash) {
            alert(receipt.transactionHash);
            location.reload();
          }
        });
    } catch (err) {
      console.log(err);
      spinner.stop();
    }
  },

  buyToken: async function (button) {
    // 대납기능 사용한당 tscontract의 purchaseToken 함수 사용

    var divInfo = $(button).closest('.panel-primary');
    var tokenId = divInfo.find('.panel-heading').text();
    var price = await this.getTokenPrice(tokenId);

    // 가격이 0, 0이하면 함수 종료
    if (price <= 0) {
      return;
    }

    // 대납
    try {
      var spinner = this.showSpinner();
      // contract 계정이 gas비용 대납
      const sender = this.getWallet(); // 로그인한 사용자 정보
      const feePayer = cav.klay.accounts.wallet.add('0x04d3278bd11e1e577804f5841968e359ec95c9226fce9d79e09876f6a953ce85');

      // using the promise 트렌젝션에 서명
      const { rawTransaction: senderRawTransaction } = await cav.klay.accounts.signTransaction({
        type: 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION',
        from: sender.address,
        to: DEPLOYED_ADDRESS_TOKENSALES,  // TOKENSALSE 컨트렉으로 보냄
        data: tsContract.methods.purchaseToken(tokenId).encodeABI(),
        gas: '500000',
        value: price,
      }, sender.privateKey)

      cav.klay.sendTransaction({
          senderRawTransaction: senderRawTransaction,
          feePayer: feePayer.address,
        })
        .then(function (receipt) {
          if (receipt.transactionHash) {
            alert(receipt.transactionHash);
            location.reload();
          }
        });
    } catch (err) {
      console.log(err);
      spinner.stop();
    }

  },

  onCancelApprovalSuccess: async function (walletInstance) {
    // 계정이 현재 판매하고있는 tokenId들을 배열에 담아 tscontract removeTokenOnSale에 전송
    var balance = parseInt(await this.getBalanceOf(walletInstance.address));  // 내가 갖고있는 토큰 개수
    
    if(balance > 0){
      var tokenOnSale = [];
      
      for(var i = 0; i  < balance; i++){
        // 소유자가 갖고 있는 토큰id들 불러옴
        var tokenId = await this.getTokenOfOwnerByIndex(walletInstance.address, i);

        // 토큰이 price 있는지
        var price = await this.getTokenPrice(tokenId);
        if( parseInt(price) > 0 ){
          tokenOnSale.push(tokenId);
        }
      }

      // 배열이 비어있지 않다면
      if(tokenOnSale.length > 0){
        const receipt = await tsContract.methods.removeTokenOnSale(tokenOnSale).send({
          from: walletInstance.address,
          gas: '250000'
        });

        // 잘 영수증이 나왔다면
        if(receipt.transactionHash){
          alert(receipt.transactionHash);
        }
      }
    }
  },

  isTokenAlreadyCreated: async function (videoId) {
    return await yttContract.methods.isTokenAlreadyCreated(videoId).call();
  },

  // metadata 생성 함수
  getERC721MetadataSchema: function (videoId, title, imgUrl) {
    return {
      "title": "Asset Metadata",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": videoId
        },
        "description": {
          "type": "string",
          "description": title
        },
        "image": {
          "type": "string",
          "description": imgUrl
        }
      }
    }
  },

  getBalanceOf: async function (address) {
    return await yttContract.methods.balanceOf(address).call();
  },

  getTokenOfOwnerByIndex: async function (address, index) {
    return await yttContract.methods.tokenOfOwnerByIndex(address, index).call();
  },

  getTokenUri: async function (tokenId) {
    return await yttContract.methods.tokenURI(tokenId).call();
  },

  getYTT: async function (tokenId) {
    return await yttContract.methods.getYTT(tokenId).call();
  },

  getMetadata: function (tokenUri) {
    return new Promise((resolve) => {
      $.getJSON(tokenUri, data => {
        resolve(data);
      })
    })
  },

  getTotalSupply: async function () {
    return await yttContract.methods.totalSupply().call();
  },

  getTokenByIndex: async function (index) {
    return await yttContract.methods.tokenByIndex(index).call();
  },

  isApprovedForAll: async function (owner, operator) {
    // 소유자 계정과 operator(tokesales contract의 주소)를 보내서 true나 false받음 (권한있는지)
    return await yttContract.methods.isApprovedForAll(owner, operator).call();
  },

  getTokenPrice: async function (tokenId) {
    // tokenPrice 매핑에 tokenId를 넘겨 price 얻어옴
    return await tsContract.methods.tokenPrice(tokenId).call();
  },

  getOwnerOf: async function (tokenId) {
    // tokenId 주인 계정 불러옴
    return await yttContract.methods.ownerOf(tokenId).call();
  },

  getBasicTemplate: function (template, tokenId, ytt, metadata) {
    template.find('.panel-heading').text(tokenId);
    template.find('img').attr('src', metadata.properties.image.description);
    template.find('img').attr('title', metadata.properties.description.description);
    template.find('.video-id').text(metadata.properties.name.description);
    template.find('.author').text(ytt[0]);
    template.find('.date-created').text(ytt[1]);

  }
};

window.App = App;

window.addEventListener("load", function () {
  App.start();
  $("#tabs").tabs().css({
    'overflow': 'auto'
  });
});

var opts = {
  lines: 10, // The number of lines to draw
  length: 30, // The length of each line
  width: 17, // The line thickness
  radius: 45, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  color: '#5bc0de', // CSS color or array of colors
  fadeColor: 'transparent', // CSS color or array of colors
  speed: 1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  className: 'spinner', // The CSS class to assign to the spinner
  top: '50%', // Top position relative to parent
  left: '50%', // Left position relative to parent
  shadow: '0 0 1px transparent', // Box-shadow for the lines
  position: 'absolute' // Element positioning
};