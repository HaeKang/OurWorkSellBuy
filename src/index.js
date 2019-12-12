import Caver from "caver-js";
import {
	Spinner
} from 'spin.js';


const config = {
	rpcURL: 'https://api.baobab.klaytn.net:8651'
}
const cav = new Caver(config.rpcURL);
const testContract = new cav.klay.Contract(DEPLOYED_ABI, DEPLOYED_ADDRESS);
const tsContract = new cav.klay.Contract(DEPLOYED_ABI_TOKENSALES, DEPLOYED_ADDRESS_TOKENSALES);

var ipfsCilent = require('ipfs-http-client');
var ipfs = ipfsCilent({
	host: 'ipfs.infura.io',
	port: '5001',
	protocol: 'https'
});

var base64_src;
var tokenOwner_address = "";
var fvWorker_address = ""
var note_sender = "";
var note_id;
var img_input;
var myfavworker = [];
var deletework = [];	// 삭제작품


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
		localStorage.clear();
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
		localStorage.setItem("my_address",walletInstance.address.toUpperCase())
		this.changeUI(walletInstance);
		location.reload();
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
		var balance = 0;

		cav.klay.getBalance(walletInstance.address).then(function (resolve, reject) {
			console.log(resolve);
			balance = cav.utils.fromPeb(resolve, "KLAY");

			$('#address').append(walletInstance.address);
			$('#mymoney').append(balance + "KLAY" );
		});

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
		var tokenId = $('#tokenId').val();
		var result = await this.isTokenAlreadyCreated(tokenId);

		if (result) {
			$('#t-message').text('이미 토큰화된 작품 아이디 입니다.');
		} else {
			$('#t-message').text('토큰화 가능한 작품 아이디 입니다.');
			$('.btn-create').prop("disabled", false);
		}
	},

	createToken: async function () {
		console.log(base64_src);

		var spinner = this.showSpinner();

		var id = $('#tokenId').val(); // 작품아이디 -> DB
		var img = base64_src; // 이미지
		var des = $('#description').val(); // 한줄설명 -> DB

		var author = this.getWallet().address; // 작성자(올리는사람 지갑 주소) -> 블록체인, DB

		var date = new Date(); 
		var year = date.getFullYear(); 
		var month = new String(date.getMonth()+1); 
		var day = new String(date.getDate()); 

		// 한자리수일 경우 0을 채워준다. 
		if(month.length == 1){ 
			month = "0" + month; 
		} 
		if(day.length == 1){ 
			day = "0" + day; 
		} 

		var dateCreated = year + "-" + month + "-" + day;
		var category = $('#category').val();	// 카테고리 -> 블록체인, DB
		var eng_category;
		

		if(category === "풍경"){
			eng_category = "landscape";
		} else if (category === "인물"){
			eng_category = "character";
		} else if (category === "동물"){
			eng_category = "animal";
		} else if (category === "음식"){
			eng_category = "food";
		} else{
			eng_category = "etc";
		}


		if (!dateCreated || !img || !id || !author || !des || !category) {
			// 값들이 제대로 입력 안되어있다면
			spinner.stop();
			alert("모두 입력해주세요");
			return;
		}


		try {
			// 값들이 제대로 왔다면 토큰발행
			const metaData = this.getERC721MetadataSchema(id, img, des); // img, 작가, 한줄평은 ipfs에 넣음
			// metaData값을 json문자열로 변환하여 ipfs에 넣음
			var res = await ipfs.add(Buffer.from(JSON.stringify(metaData)));
			await this.mintYTT(id, author, dateCreated, category, res[0].hash, eng_category, des, img);
		} catch (err) {
			console.error(err);
			alert("네트워크 오류가 생겼습니다. 다시 제출 버튼을 눌러주세요.");
			spinner.stop();
		}
	},

	mintYTT: async function (id, author, dateCreated, category, hash ,eng_category , des, img) {
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
			data: testContract.methods.mintYTT(id, author, dateCreated, category, "https://ipfs.infura.io/ipfs/" + hash).encodeABI(),
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

					// DB에 넣기
					$.ajax({
							url: '/tokencreate',
							dataType: 'json',
							async: true,
							type: 'POST',
							contentType: 'application/json; charset=UTF-8',
							data: JSON.stringify({
								"author": author,
								"regi_date":dateCreated,
								"category":eng_category,
								"work_id" :id,
								"description" :des,
								"image" : img
							}),
						success: function (data) {

						},
						error: function (err) {
							console.log("에러발생");
						}
					});

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
					var price = await this.getTokenPrice(tokenId); // 소유자의 토큰 중 판매중인지 아닌지 price값을 통해 알아보자

				
					if(deletework.length){

						for( var j = 0; j < deletework.length; j ++){
							if(deletework[j] == tokenId){
	
							} else{
								this.renderMyTokens(tokenId, ytt, metadata, isApproved, price);
	
								if (parseInt(price) > 0) {
									// 0보다 크면 판매중인 토큰
									this.renderMyTokensSale(tokenId, ytt, metadata, price);
								}
							}
						}

					} else{

						this.renderMyTokens(tokenId, ytt, metadata, isApproved, price);
	
						if (parseInt(price) > 0) {
							// 0보다 크면 판매중인 토큰
							this.renderMyTokensSale(tokenId, ytt, metadata, price);
						}

					}

				})();
			}
		}
	},

	displayAllTokens: async function (walletInstance) {
		var totalSupply = parseInt(await this.getTotalSupply());
		if (totalSupply === 0) {
			$('#allTokens2').text("현재 발행된 토큰이 없습니다.");
		} else {
			$('#allTokens2').empty();
			for (var i = 0; i < totalSupply; i++) {
				(async () => {
					// tokenId 받아옴
					var tokenId = await this.getTokenByIndex(i);
					var tokenUri = await this.getTokenUri(tokenId); // token uri(infa였나 그거 주소 meta데이터 갖고있는 주소)
					var ytt = await this.getYTT(tokenId); // ytt 클래스
					var metadata = await this.getMetadata(tokenUri); // meta데이터
					var price = await this.getTokenPrice(tokenId); // 판매 가격
					var owner = await this.getOwnerOf(tokenId); // 토큰 소유자
					

					if(deletework.length){

						for( var j = 0; j < deletework.length; j ++){
							if(deletework[j] == tokenId){
	
							} else{
								this.renderAllTokens(tokenId, ytt, metadata, price, owner, walletInstance);
							}
						}

					} else{

						this.renderAllTokens(tokenId, ytt, metadata, price, owner, walletInstance);

					}

				})();
			}
		}
	},

	displayTrendTokens: async function () {
		var totalSupply = parseInt(await this.getTotalSupply());
		if (totalSupply === 0) {
			
		} else {
			for (var i = 0; i < 3; i++) {
				(async () => {
					if(totalSupply - i >0){
						var text = "#port" + (i+1);
						var imgTag = $(text);

						console.log(i);
						console.log(text);

						var tokenUri = await this.getTokenUri(totalSupply - i); 
						var metadata = await this.getMetadata(tokenUri); 
						imgTag.attr('src',metadata.properties.image.description);	
					}
				})();
			}
		}
	},


	displayFindTokens: async function (address, tokenIdList) {
		if (tokenIdList.length == 0) {
			$('#allTokens2').text("해당하는 토큰이 없습니다.");
		} else {
			$('#allTokens2').empty();
			for (var i = 0; i < tokenIdList.length; i++) {
				(async () => {
					// tokenId 받아옴
					var tokenId = tokenIdList[i];
					var tokenUri = await this.getTokenUri(tokenId); // token uri(infa였나 그거 주소 meta데이터 갖고있는 주소)
					var ytt = await this.getYTT(tokenId); // ytt 클래스
					var metadata = await this.getMetadata(tokenUri); // meta데이터
					var price = await this.getTokenPrice(tokenId); // 판매 가격
					var owner = await this.getOwnerOf(tokenId); // 토큰 소유자

					if(deletework.length){

						for( var j = 0; j < deletework.length; j ++){
							if(deletework[j] == tokenId){
	
							} else{
								this.renderSearchTokens(tokenId, ytt, metadata, price, owner, address);
							}
						}

					} else{
						this.renderSearchTokens(tokenId, ytt, metadata, price, owner, address);
					}

				})();
			}
		}
	},

	
	displaySaleToken: async function (address) {
		var totalSupply = parseInt(await this.getTotalSupply());
		$('#allTokens2').empty();
		
		for (var i = 0; i < totalSupply; i++) {
			(async () => {
				// tokenId 받아옴
				var tokenId = await this.getTokenByIndex(i);
				var tokenUri = await this.getTokenUri(tokenId); // token uri(infa였나 그거 주소 meta데이터 갖고있는 주소)
				var ytt = await this.getYTT(tokenId); // ytt 클래스
				var metadata = await this.getMetadata(tokenUri); // meta데이터
				var price = await this.getTokenPrice(tokenId); // 판매 가격
				var owner = await this.getOwnerOf(tokenId); // 토큰 소유자

				if(deletework.length){

					for( var j = 0; j < deletework.length; j ++){
						if(deletework[j] == tokenId){
	
						} else{
							if(price > 0){
								this.renderSaleToken(tokenId, ytt, metadata, price, owner, address);
							}
						}
					}

				} else{

					if(price > 0){
						this.renderSaleToken(tokenId, ytt, metadata, price, owner, address);
					}

				}

										
			})();
		}
		
	},

	displayFvWorkerToken: async function (address) {
		var totalSupply = parseInt(await this.getTotalSupply());
		$('#workerTokens').empty();

		for (var i = 0; i < totalSupply; i++) {
			(async () => {
				// tokenId 받아옴
				var tokenId = await this.getTokenByIndex(i);
				var tokenUri = await this.getTokenUri(tokenId); // token uri(infa였나 그거 주소 meta데이터 갖고있는 주소)
				var ytt = await this.getYTT(tokenId); // ytt 클래스
				var metadata = await this.getMetadata(tokenUri); // meta데이터
				var price = await this.getTokenPrice(tokenId); // 판매 가격
				var owner = await this.getOwnerOf(tokenId); // 토큰 소유자
	

				if(deletework.length){

					for( var j = 0; j < deletework.length; j ++){
						if(deletework[j] == tokenId){
	
						} else{
							if($.inArray(ytt[0].toUpperCase(),myfavworker) > -1){
								this.renderFvWorkerTokens(tokenId, ytt, metadata, price, owner, address);
							}
						}
					}
					
				} else{

					if($.inArray(ytt[0].toUpperCase(),myfavworker) > -1){
						this.renderFvWorkerTokens(tokenId, ytt, metadata, price, owner, address);
					}

				}

										
			})();
		}
		
	},

	// 모든 토큰 렌더링
	renderFvWorkerTokens: function (tokenId, ytt, metadata, price, owner, address) {
		var tokens = $('#workerTokens');
		var template = $('#AllTokensTemplate');

		this.getBasicTemplate(template, tokenId, ytt, metadata);

		var author = ytt[0].toUpperCase()
		var owner_up = owner.toUpperCase()
		template.find('.token-owner').html("<div id='token-owner-sub' value='"+ owner_up + "'>" + owner_up +"</div>");	// 토큰소유자
		template.find('.token-maker').html("<div id='token-maker-sub' value='"+ author + "'>" + author +"</div>");	// 작가

		template.find('.panel-heading').html(tokenId + '<a class="btn-report-token trigger" id="report_' + tokenId + '"><i class="fas fa-satellite"></i></a>');

		// 토큰 구매 보이기
		if (parseInt(price) > 0) {
			template.find('.buy-token').show();

			// 로그인한 회원이 판매중인 토큰 주인이라면
			if (owner.toUpperCase() === address) {
				template.find('.btn-buy').attr('disabled', true);
				template.find('.token-price').html("보유 중인 토큰<br>"+cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			} else {
				template.find('.btn-buy').attr('disabled', false);
				template.find('.token-price').text(cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			}

		} else {
			template.find('.buy-token').hide();
		}

		tokens.append(template.html());
	},


	renderMyTokens: function (tokenId, ytt, metadata, isApproved, price) {
		var tokens = $('#myTokens');
		var template = $('#MyTokensTemplate');
		
		this.getBasicTemplate(template, tokenId, ytt, metadata);
		$('#MyTokensTemplate').find('.panel-heading').html(tokenId + '<a class="btn-delete-token trigger" id="' + tokenId + '"><i class="fas fa-trash-alt"></i></a>');

		// 판매 허락을 했다면
		if (isApproved) {
			
			$('.btn-delete-token').hide();

			//price에 값이 있으면 판매버튼 안보이게
			if (parseInt(price) > 0) {
				template.find('.sell-token').hide();
			} else {
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
		template.find('.on-sale').text(cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
		tokens.append(template.html());
	},

	// 모든 토큰 렌더링
	renderAllTokens: function (tokenId, ytt, metadata, price, owner, walletInstance) {
		var tokens = $('#allTokens2');
		var template = $('#AllTokensTemplate');

		this.getBasicTemplate(template, tokenId, ytt, metadata);

		var author = ytt[0].toUpperCase()
		var owner_up = owner.toUpperCase()
		template.find('.token-owner').html("<div id='token-owner-sub' value='"+ owner_up + "'>" + owner_up +"</div>");	// 토큰소유자
		template.find('.token-maker').html("<div id='token-maker-sub' value='"+ author + "'>" + author +"</div>");	// 작가

		template.find('.panel-heading').html(tokenId + '<a class="btn-report-token trigger" id="report_' + tokenId + '"><i class="fas fa-satellite"></i></a>');

		// 토큰 구매 보이기
		if (parseInt(price) > 0) {
			template.find('.buy-token').show();

			// 로그인한 회원이 판매중인 토큰 주인이라면
			if (owner.toUpperCase() === walletInstance.address.toUpperCase()) {
				template.find('.btn-buy').attr('disabled', true);
				template.find('.token-price').html("보유 중인 토큰<br>"+cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			} else {
				template.find('.btn-buy').attr('disabled', false);
				template.find('.token-price').text(cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			}

		} else {
			template.find('.buy-token').hide();
		}

		tokens.append(template.html());
	},

	renderSaleToken: function (tokenId, ytt, metadata, price, owner, address) {
		var tokens = $('#allTokens2');
		var template = $('#AllTokensTemplate');

		this.getBasicTemplate(template, tokenId, ytt, metadata);		
		
		var owner_up = owner.toUpperCase()
		template.find('.token-owner').html("<div id='token-owner-sub' value='"+ owner_up + "'>" + owner_up +"</div>");
		template.find('.token-maker').html("<div id='token-maker-sub' value='"+ ytt[0] + "'>" + ytt[0] +"</div>");

		template.find('.panel-heading').html(tokenId + '<a class="btn-report-token trigger" id="report_' + tokenId + '"><i class="fas fa-satellite"></i></a>');

		// 토큰 구매 보이기
		if (parseInt(price) > 0) {
			template.find('.buy-token').show();

			// 로그인한 회원이 판매중인 토큰 주인이라면
			if (owner.toUpperCase() === address) {
				template.find('.btn-buy').attr('disabled', true);
				template.find('.token-price').html("보유 중인 토큰<br>"+cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			} else {
				template.find('.btn-buy').attr('disabled', false);
				template.find('.token-price').text(cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			}

		} else {
			template.find('.buy-token').hide();
		}

		tokens.append(template.html());
	},

	renderSearchTokens: function (tokenId, ytt, metadata, price, owner, address) {
		var tokens = $('#allTokens2');
		var template = $('#AllTokensTemplate');

		this.getBasicTemplate(template, tokenId, ytt, metadata);
		
		var owner_up = owner.toUpperCase()
		template.find('.token-owner').html("<div id='token-owner-sub' value='"+ owner_up + "'>" + owner_up +"</div>");
		template.find('.token-maker').html("<div id='token-maker-sub' value='"+ ytt[0] + "'>" + ytt[0] +"</div>");

		template.find('.panel-heading').html(tokenId + '<a class="btn-report-token trigger" id="report_' + tokenId + '"><i class="fas fa-satellite"></i></a>');

		// 토큰 구매 보이기
		if (parseInt(price) > 0) {
			template.find('.buy-token').show();

			// 로그인한 회원이 판매중인 토큰 주인이라면
			if (owner.toUpperCase() === address) {
				template.find('.btn-buy').attr('disabled', true);
				template.find('.token-price').html("보유 중인 토큰<br>"+cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			} else {
				template.find('.btn-buy').attr('disabled', false);
				template.find('.token-price').text(cav.utils.fromPeb(price, 'KLAY') + "KLAY에 판매중");
			}

		} else {
			template.find('.buy-token').hide();
		}

		tokens.append(template.html());
	},

	approve: function () {
		this.showSpinner();
		const walletInstance = this.getWallet();

		// contract의 판매 권한 부여
		testContract.methods.setApprovalForAll(DEPLOYED_ADDRESS_TOKENSALES, true).send({
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
		const receipt = await testContract.methods.setApprovalForAll(DEPLOYED_ADDRESS_TOKENSALES, false).send({
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
			const {
				rawTransaction: senderRawTransaction
			} = await cav.klay.accounts.signTransaction({
				type: 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION',
				from: sender.address,
				to: DEPLOYED_ADDRESS_TOKENSALES, // TOKENSALSE 컨트렉으로 보냄
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
			const {
				rawTransaction: senderRawTransaction
			} = await cav.klay.accounts.signTransaction({
				type: 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION',
				from: sender.address,
				to: DEPLOYED_ADDRESS_TOKENSALES, // TOKENSALSE 컨트렉으로 보냄
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
		var balance = parseInt(await this.getBalanceOf(walletInstance.address)); // 내가 갖고있는 토큰 개수

		if (balance > 0) {
			var tokenOnSale = [];

			for (var i = 0; i < balance; i++) {
				// 소유자가 갖고 있는 토큰id들 불러옴
				var tokenId = await this.getTokenOfOwnerByIndex(walletInstance.address, i);

				// 토큰이 price 있는지
				var price = await this.getTokenPrice(tokenId);
				if (parseInt(price) > 0) {
					tokenOnSale.push(tokenId);
				}
			}

			// 배열이 비어있지 않다면
			if (tokenOnSale.length > 0) {
				const receipt = await tsContract.methods.removeTokenOnSale(tokenOnSale).send({
					from: walletInstance.address,
					gas: '250000'
				});

				// 잘 영수증이 나왔다면
				if (receipt.transactionHash) {
					alert(receipt.transactionHash);
				}
			}
		}
	},

	isTokenAlreadyCreated: async function (videoId) {
		return await testContract.methods.isTokenAlreadyCreated(videoId).call();
	},

	// metadata 생성 함수
	getERC721MetadataSchema: function (id, img, des) {
		return {
			"title": "Asset Metadata",
			"type": "object",
			"properties": {
				"name": {
					"type": "string",
					"description": id
				},
				"image": {
					"type": "string",
					"description": img
				},
				"description": {
					"type": "string",
					"description": des
				}
			}
		}
	},

	// 판매중인 토큰 갯수
	getBalanceOf: async function (address) {
		return await testContract.methods.balanceOf(address).call();
	},

	getTokenOfOwnerByIndex: async function (address, index) {
		return await testContract.methods.tokenOfOwnerByIndex(address, index).call();
	},

	getTokenUri: async function (tokenId) {
		return await testContract.methods.tokenURI(tokenId).call();
	},

	getYTT: async function (tokenId) {
		return await testContract.methods.getYTT(tokenId).call();
	},

	getMetadata: function (tokenUri) {
		return new Promise((resolve) => {
			$.getJSON(tokenUri, data => {
				resolve(data);
			})
		})
	},

	getTotalSupply: async function () {
		return await testContract.methods.totalSupply().call();
	},

	getTokenByIndex: async function (index) {
		return await testContract.methods.tokenByIndex(index).call();
	},

	isApprovedForAll: async function (owner, operator) {
		// 소유자 계정과 operator(tokesales contract의 주소)를 보내서 true나 false받음 (권한있는지)
		return await testContract.methods.isApprovedForAll(owner, operator).call();
	},

	getTokenPrice: async function (tokenId) {
		// tokenPrice 매핑에 tokenId를 넘겨 price 얻어옴
		return await tsContract.methods.tokenPrice(tokenId).call();
	},

	getOwnerOf: async function (tokenId) {
		// tokenId 주인 계정 불러옴
		return await testContract.methods.ownerOf(tokenId).call();
	},

	getBasicTemplate: function (template, tokenId, ytt, metadata) {
		template.find('.panel-heading').text(tokenId);
		template.find('img').attr('src', metadata.properties.image.description);
		template.find('img').attr('title', "작가: " + ytt[0]);
		template.find('.video-id').text(metadata.properties.name.description);
		template.find('.author').text(metadata.properties.description.description);
		template.find('.date-created').text(ytt[1]);
		template.find('.category').text(ytt[2]);

	},

	ImgSizeCheck : function(img){
		var width = img.naturalWidth;
		var height = img.naturalHeight;
		console.log(width + " , " + height);

		$('#temp_img').remove();


		if(width < 80 || height < 80 || !width  || !height ){
			alert("이미지 파일 크기가 너무 작습니다!");
			$("#img_test-id").replaceWith( $("#img_test-id").clone(true) );
			$("#img_test-id").val("");
			$('#imgPreview').attr('src', "");
			img_input = "";
		} else{
			var filedr = new FileReader();
			filedr.onload = function (e) {

				$('#imgPreview').attr('src', e.target.result);
				base64_src = e.target.result; // base64 코드

			}
			filedr.readAsDataURL(img_input.files[0]);
			img_input = "";
		}

		
	},

	// 이미지 미리보기 & 이미지 base64 전송
	showIMG: function (input) {
		var fileNm = $('#img_test-id').val();
		img_input = input;

		if(fileNm != ""){
			var ext = fileNm.slice(fileNm.lastIndexOf(".") + 1).toLowerCase();
			
			// 이미지파일이 아니면
    		if (!(ext == "jpg" || ext == "png")) {
					
					alert("이미지파일 (.jpg, .png) 만 업로드 가능합니다.");
					$("#img_test-id").replaceWith( $("#img_test-id").clone(true) );
					$("#img_test-id").val("");
					$('#imgPreview').attr('src', "");
					img_input = "";
					return false;

			} else{
				if (input.files && input.files[0]) {
					var filedr = new FileReader();
					filedr.onload = function (e) {
						$('body').append('<img src="" id="temp_img" style="display:none;" onload="App.ImgSizeCheck(this)"/>');
						console.log("temp_img 추가");
						
						$('#temp_img').attr('src', e.target.result);  				
					}
					filedr.readAsDataURL(input.files[0]);	
				}
			}
		}
	},

	// 쪽지함 목록 불러오기 4개씩
	readNote : function(data, page){
		$('#table_body').empty();
		$('.content_list').empty();

		for (var i = 4 * (page-1); i < page*4; i++) {
			if(data[i]){
				var address = data[i].sender;
				var review = data[i].contents;
				var note_id = data[i].note_id;
				$('#table_body').append('<tr class="note_select" id="' + note_id + '"><td class="table_address">' + address + '</td><td>' + review + '</td><td></tr>')
			}
		}

		for(var i = 0; i < data.length / 4;  i++){
			if( i === 0 ){
				$('.content_list').append('<text class = "listClick" id="note_list_page" onclick="App.readNotePage(' + (i+1) +', this)">' + (i+1) + "</text>" );
			}else {
				$('.content_list').append('<text id="note_list_page" onclick="App.readNotePage(' + (i+1) +', this)">' + (i+1) + "</text>" );
			}
			$('.content_list').append('<text>  </text>');
		}
	},

	readNotePage : function(page, event){
		var go_url = '/notebox/' + page;
		// css 변경
		$('#note_list_page').attr("class","");
		$(event).addClass("listClick");


		$.ajax({
			url: go_url,
			dataType: 'json',
			async: true,
			type: 'POST',
			contentType: 'application/json; charset=UTF-8',
			data: JSON.stringify({
				"address": localStorage.getItem("my_address")
			}),
			success: function (data) {
				$('#table_body').empty();

				for (var i = 4 * (page-1); i < page*4; i++) {
					if(data[i]){
						var address = data[i].sender;
						var review = data[i].contents;
						var note_id = data[i].note_id;
						$('#table_body').append('<tr class="note_select" id="' + note_id + '"><td class="table_address">' + address + '</td><td>' + review + '</td><td></tr>')
					}
				}
			},
			error: function (err) {

			}
		});

	},

	sendNote: function () {

		var contents = $('#note_content').val(); 
		var sender = localStorage.getItem("my_address");
		var receiver = "";

		if(tokenOwner_address != ""){
			receiver = tokenOwner_address;
			console.log("토큰주인 : " + receiver);
		} else if (note_sender != ""){
			receiver = note_sender
			console.log("쪽지답장 : " + receiver);
		}

		console.log(receiver);

		if (!contents) {
			spinner.stop();
			alert("내용을 입력해주세요!");
			return;
		}

		try {
				$.ajax({
					url: '/send',
					dataType: 'json',
					async: true,
					type: 'POST',
					contentType: 'application/json; charset=UTF-8',
					data: JSON.stringify({
						"sender": sender,
						"receiver":receiver,
						"contents":contents 
					}),
					success: function () {
						
					},
					error: function (err) {
						console.log("에러발생");
					}
				});

				alert("쪽지를 성공적으로 보냈습니다!");
				$('.modal-wrapper').toggleClass('open');
				$('#service').toggleClass('blur-it');
				tokenOwner_address = "";
				note_sender = "";
				$("#note_content").replaceWith( $("#note_content").clone(true) );
				$("#note_content").val("");

		} catch (err) {
			console.error(err);
			spinner.stop();
		}
	},

	checkImgSim : function(){

		var spinner = this.showSpinner();

		if(base64_src){

			$.ajax({
				url: '/imageinsert',
				dataType: 'json',
				async: true,
				type: 'POST',
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					"image": base64_src
				}),
				success: function () {
					
				},
				error: function (err) {
					console.log("에러발생");
				}
			});



		} else{
			alert("이미지를 업로드해주세요!");
			spinner.stop();
		}
	}

};

window.App = App;

window.addEventListener("load", function () {
	App.start();
	$("#tabs").tabs().css({
		'overflow': 'auto'
	});
});

$(document).ready(function () {

	App.displayTrendTokens();

		// 삭제된 작품 불러옴
		$.ajax({
			url: '/delete_worklist',
			dataType: 'json',
			async: true,
			type: 'POST',
			contentType: 'application/json; charset=UTF-8',
			success: function (data) {
				deletework = [];
				if(data.length){
					for(var i = 0; i < data.length; i ++){
						deletework.push(data[i].token_id);
					}
				}
				console.log("deletework : " + deletework);
			},
			error: function (err) {
				console.log(err);
			}
		}); 

	// 관심 작가 불러옴
	$.ajax({
		url: '/find_myfvworker',
		dataType: 'json',
		async: true,
		type: 'POST',
		contentType: 'application/json; charset=UTF-8',
		data: JSON.stringify({
			"myaddress" : localStorage.getItem("my_address")
		}),
		success: function (data) {
			render_fvwork(data);
		},
		error: function (err) {
			console.log(err);
		}
	}); 


	$("#notebox").click(function () {
		// 쪽지 불러오기
		$('.modal-wrapper-receive').toggleClass('open');
		$('#service').toggleClass('blur-it');
		$('#note_list_page').removeClass("listClick");
		var my_address = 

		$.ajax({
			url: '/notebox/1',
			dataType: 'json',
			async: true,
			type: 'POST',
			contentType: 'application/json; charset=UTF-8',
			data: JSON.stringify({
				"address": localStorage.getItem("my_address")
			}),
			success: function (data) {
				App.readNote(data, 1);
			},
			error: function (err) {

			}
		});
	});


	// 쪽지함 창 닫기
	$(document).on('click','.btn-close-receive',function(e){
		$('.modal-wrapper-receive').toggleClass('open');
		$('#service').toggleClass('blur-it');
	});

	// 쪽지 클릭
	$(document).on('click', '.note_select', function(){
		$('.modal-wrapper-content').addClass('open');
		note_id = this.id;
		console.log(note_id);
		
		$.ajax({
			url: '/note_read',
			dataType: 'json',
			async: true,
			type: 'POST',
			contentType: 'application/json; charset=UTF-8',
			data: JSON.stringify({
				"note_id": note_id
			}),
			success: function (data) {
				readNoteData(data);
			},
			error: function (err) {

			}
		});

	});		


	// 쪽지보기 창 닫기
	$(document).on('click','.btn-close-show',function(){
		$('.modal-wrapper-content').removeClass('open');
		console.log("쪽지보기닫기");
	});	

	// 쪽지 삭제 버튼 클릭
	$(document).on('click','.btn-send-delete',function(){
		console.log(note_id);
		$.ajax({
			url: '/note_delete',
			dataType: 'json',
			async: false,
			type: 'POST',
			contentType: 'application/json; charset=UTF-8',
			data: JSON.stringify({
				"note_id": note_id
			}),
			success: function (data) {
				$('.modal-wrapper-content').removeClass('open');
				$('.modal-wrapper-receive').toggleClass('open');
				$('#service').toggleClass('blur-it');
				alert("삭제했습니다!");
			},
			error: function (err) {

			}
		});	

	});


	// 쪽지 답장보내기 창 열기
	$(document).on('click', '.btn-send-note', function(){
		$('.modal-wrapper-content').removeClass('open');
		$('.modal-wrapper-receive').toggleClass('open');
		$('.modal-wrapper').toggleClass('open');		
		
	});

	// 쪽지보내기
	$(document).on('click','#token-owner-sub',function(e){
		var address = e.currentTarget.textContent;
		tokenOwner_address = address;

		// 내 계정이면
		if(localStorage.getItem("my_address") === address){
			
		} else{
			// 다른 계정이면
			$('.modal-wrapper').toggleClass('open');
			$('#service').toggleClass('blur-it');
		}

	});

	// 쪽지보내기 창 닫기
	$(document).on('click','.btn-close',function(e){
		$('.modal-wrapper').toggleClass('open');
		$('#service').toggleClass('blur-it');

		note_sender = "";
		tokenOwner_address = "";
		$("#note_content").replaceWith( $("#note_content").clone(true) );
		$("#note_content").val("");
	});


	// 토큰 신고 버튼 클릭
	$(document).on('click','.btn-report-token',function(e){
		var token_id = e.currentTarget.id;
		token_id = token_id.substring(7);
		if(confirm("이 작품을 신고하겠습니까?")){
			$.ajax({
				url: '/report_work',
				dataType: 'json',
				async: true,
				type: 'POST',
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					"token_id" : token_id,
					"address": localStorage.getItem("my_address")
				}),
				success: function (data) {
					if(data.length){
						alert("작품은 한번만 신고할 수 있습니다.");
					} else{
						alert("신고를 완료했습니다!");
					}
				},
				error: function (err) {
					alert(err);
				}
			}); 
		} else{
			return;
		}
	});

	// 토큰 삭제 클릭
	$(document).on('click','.btn-delete-token',function(e){
		var token_id = e.currentTarget.id;	// 작가 주소
		if(confirm("정말 작품을 삭제하시겠습니까?")){
			$.ajax({
				url: '/delete_work',
				dataType: 'json',
				async: true,
				type: 'POST',
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					"token_id" : token_id
				}),
				success: function (data) {
		
				},
				error: function (err) {
					alert(err);
				}
			}); 
			alert("삭제하였습니다!")
			location.reload();
		} else{
			return;
		}

	});

	// 토큰 작가 클릭
	$(document).on('click','#token-maker-sub',function(e){
		var address = e.currentTarget.textContent;	// 작가 주소
		fvWorker_address = address;

		// 내 계정이면
		if(localStorage.getItem("my_address") === address){
			
		} else{
			// 다른 계정이면
			$('.modal-wrapper-addWorker').toggleClass('open');
			$('#service').toggleClass('blur-it');
			$('.content-worker').empty();
			$('.content-worker').html("<strong>" +address + "</strong><br>작가님을 관심작가로 등록할까요?");

		}

	});

	// 토큰 작가 관심작가 추가
	$(document).on('click','#addWorker',function(e){

		// 이미 있으면
		if($.inArray(fvWorker_address,myfavworker) > -1){
			alert("이미 추가한 작가입니다!");

		} else{
			$.ajax({
				url: '/add_myfavWorker',
				dataType: 'json',
				async: true,
				type: 'POST',
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					"myaddress" : localStorage.getItem("my_address"),
					"worker": fvWorker_address
				}),
				success: function (data) {
		
				},
				error: function (err) {
					alert(err);
				}
			}); 
			alert("추가하였습니다!")
		}

		$('.modal-wrapper-addWorker').toggleClass('open');
		$('#service').toggleClass('blur-it');
		fvWorker_address = "";
		location.reload();
	});

	// 토큰 작가 클릭 창 닫기 2개
	$(document).on('click','.btn-close-addWorker',function(e){
		$('.modal-wrapper-addWorker').toggleClass('open');
		$('#service').toggleClass('blur-it');

		fvWorker_address = "";

	});

	$(document).on('click','#noWorker',function(e){
		$('.modal-wrapper-addWorker').toggleClass('open');
		$('#service').toggleClass('blur-it');

		fvWorker_address = "";

	});


	// 내 관심 작가 목록에서 삭제하기
	$(document).on('click','.my_fv_list',function(e){
		var fav_id = e.currentTarget.id;

		if(confirm("클릭한 작가님을 관심작가에서 제거하시겠습니까?")){

			$.ajax({
				url: '/delete_myfvworker',
				dataType: 'json',
				async: true,
				type: 'POST',
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					"fav_id": fav_id
				}),
				success: function (data) {
					alert("삭제하였습니다!")
				},
				error: function (err) {
	
				}
			}); 
			location.reload();
		}else{
			return;
		}
	});


	// 카테고리 클릭
	$('#portfolio-flters li').on( 'click', function() {
		$("#portfolio-flters li").removeClass('filter-active');
		$(this).addClass('filter-active');
		var category = this.textContent
		var tokenIdList = [];
		
		if(category != "for sale"){

			$.ajax({
				url: '/search_category_token',
				dataType: 'json',
				async: true,
				type: 'POST',
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					"category": category
				}),
				success: function (data) {
					for(var i = 0; i < data.length; i++){
						tokenIdList.push(data[i].token_id);
					}
					console.log(tokenIdList);
					App.displayFindTokens(localStorage.getItem("my_address"), tokenIdList);
				},
				error: function (err) {
	
				}
			}); 


		} else{
			App.displaySaleToken(localStorage.getItem("my_address"));
		}
		
	});
	

	if($("#select_search_type option:selected").val() == "등록날짜"){
		alert( $("#select_search_type option:selected").val() )
		$("#search_text").datepicker({
			dateFormat:"yy-mm-dd"
		});
	}

	// 검색창 검색 버튼 클릭
	$(document).on('click','.btn-search',function(){
		var keyword = $('#search_text').val();
		var search_type = $("#select_search_type option:selected").val()
		var tokenIdList = [];

		if(search_type == "Category"){
			alert("검색타입을 선택해주세요");
		}
		else{
			$.ajax({
				url: '/search_input_token',
				dataType: 'json',
				async: true,
				type: 'POST',
				contentType: 'application/json; charset=UTF-8',
				data: JSON.stringify({
					"keyword": keyword,
					"search_type" : search_type
				}),
				success: function (data) {
					search_tokenid(data);
				},
				error: function (err) {
	
				}
			}); 
		}
	});


	function render_fvwork(data){
		console.log(data);
		myfavworker = [];
		$('#myfvworker').empty();
		$('#myfvworker').append("<strong> 내 관심작가 목록 </strong><br>")
		for(var i = 0; i < data.length; i++){
			myfavworker.push(data[i].worker);
			$('#myfvworker').append("<p class='my_fv_list' id='" + data[i].fav_id + "'>" + data[i].worker + "</p>");
		}
		App.displayFvWorkerToken(localStorage.getItem("my_address"));
	}


	function readNoteData(data){
		var sender = data[0].sender;
		note_sender = sender;
		console.log("쪽지 보낸이 : " + note_sender);
		var contents = data[0].contents;

		$('.content-show').empty();
		$('.content-show').html(sender + " : " + contents);
		
	}

	function search_tokenid(data){
		for(var i = 0; i < data.length; i++){
			tokenIdList.push(data[i].token_id);
		}
		console.log(tokenIdList);
		App.displayFindTokens(localStorage.getItem("my_address"), tokenIdList);
	}
	

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
