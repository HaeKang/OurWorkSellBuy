import Caver from "caver-js";

const config = {
	rpcURL: 'https://api.baobab.klaytn.net:8651'
}
const cav = new Caver(config.rpcURL);
const testContract = new cav.klay.Contract(DEPLOYED_ABI, DEPLOYED_ADDRESS);

var report_list = [];

const App2 = {
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
        report_list = [];
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
        
        if(walletInstance.address.toUpperCase() == DEPLOYED_ADDRESS_TOKENSALES.toUpperCase()){
            this.changeUI(walletInstance);
            localStorage.setItem("admin_address",walletInstance.address.toUpperCase())
            location.reload();
        } else{
            alert("접근 권한이 없습니다!")
            window.location.href = 'http://localhost:3000/';
        }
       
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

		await this.displayReportTokens(report_list);
	},

	removeWallet: function () {
		cav.klay.accounts.wallet.clear();
		sessionStorage.removeItem('walletInstance');
		this.reset();
    },
    
    displayReportTokens: async function (report_list) {
		if (report_list.length == 0) {
			$('#ReportToken').text("해당하는 토큰이 없습니다.");
		} else {
			$('#ReportToken').empty();
			for (var i = 0; i < report_list.length; i++) {
				(async () => {
					// tokenId 받아옴
					var tokenId = report_list[i];
					var tokenUri = await this.getTokenUri(tokenId); // token uri(infa였나 그거 주소 meta데이터 갖고있는 주소)
					var ytt = await this.getYTT(tokenId); // ytt 클래스
					var metadata = await this.getMetadata(tokenUri); // meta데이터

					this.renderReportToken(tokenId, ytt, metadata);

				})();
			}
		}
    },

    renderReportToken: function (tokenId, ytt, metadata) {
		var tokens = $('#ReportToken');
		var template = $('#ReportTokenTemplate');
		
		this.getBasicTemplate(template, tokenId, ytt, metadata);
        template.find('.panel-heading').html(tokenId + '<a class="btn-delete-token trigger" id="' + tokenId + '"><i class="fas fa-trash-alt"></i></a>');
        
		tokens.append(template.html());
    },
    
    getBasicTemplate: function (template, tokenId, ytt, metadata) {
		template.find('.panel-heading').text(tokenId);
		template.find('img').attr('src', metadata.properties.image.description);
		template.find('img').attr('title', "작가: " + ytt[0]);
		template.find('.video-id').text(metadata.properties.name.description);
		template.find('.author').text(metadata.properties.description.description);
		template.find('.date-created').text(ytt[1]);
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
	}

}

$(document).ready(function () {

		// 신고목록 불러옴
		$.ajax({
			url: '/admin_report_list',
			dataType: 'json',
			async: true,
			type: 'POST',
			contentType: 'application/json; charset=UTF-8',
			success: function (data) {
				report_list = [];
				if(data.length){
					for(var i = 0; i < data.length; i ++){
						report_list.push(data[i].token_id);
					}
				}
				console.log("report_list : " + report_list);
			},
			error: function (err) {
				console.log(err);
			}
        }); 


    // 토큰 삭제 클릭
	$(document).on('click','.btn-delete-token',function(e){
		var token_id = e.currentTarget.id;	// 작가 주소
		if(confirm("이 작품을 삭제하겠습니까?")){
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

});
