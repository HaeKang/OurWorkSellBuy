pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

contract TokenSales {
    ERC721Full public nftAddress;

    // key값 tokenId, value token 가격
    // public이라 외부에서 호출 가능
    mapping(uint256 => uint256) public tokenPrice;


    constructor(address _tokenAddress) public {
         nftAddress = ERC721Full(_tokenAddress);
     }

    // 내 토큰 중 하나를 골라서 얼마를 팔건지 입력한 값과 그 토큰의 아이디를 받음 / 파는 함수
    function setForSale(uint256 _tokenId, uint256 _price) public {
        address tokenOwner = nftAddress.ownerOf(_tokenId);

        // 함수 부른 사람이 token 주인인지
        require(tokenOwner == msg.sender, "caller is not token owner");

        require(_price > 0 , "price is zero or lower");
        
        // isApproveForAll -> 내가 가진 토큰의 판매 권한 다 줬는지 체킁 tokenOwner가 address(this)에게
        require(nftAddress.isApprovedForAll(tokenOwner, address(this)), "token owner did not approve TokenSales contrace");
        
        // 블록체인에 저장
        tokenPrice[_tokenId] = _price;
    }

    // 토큰 구매 함수
    function purchaseToken(uint256 _tokenId) public payable {
        uint256 price = tokenPrice[_tokenId];   // token 가격
        address tokenSeller = nftAddress.ownerOf(_tokenId); // tokenId 소유자

        // 함수 부른사람의 value가 price값 보다 크거나 같아야함
        require(msg.value >= price, "caller sent klay lower than price");

        // 함수 부른사람이 파는사람과 같지 않아야함
        require(msg.sender != tokenSeller, "caller is token seller");

        // 판매자에게 klay 송금
        address payable payableTokenSeller = address(uint160(tokenSeller)); // 판매자계정
        payableTokenSeller.transfer(msg.value); // 송금
        nftAddress.safeTransferFrom(tokenSeller, msg.sender, _tokenId); // tokenseller계정에서 구매자계정으로 토큰 전송
        tokenPrice[_tokenId] = 0;   // 토큰id에 대한 판매가격 0으로 변경하여 토큰 판매 끝났다는 것을 의미
    }

    // 판매 취소 함수
    function removeTokenOnSale(uint256[] memory tokenIds) public {
        // 넘어오는 배열값(tokenIds)의 길이가 0보다 커야함
        require(tokenIds.length > 0, "tokenIds is empty");

        for(uint i = 0; i < tokenIds.length; i++){
            uint256 tokenId = tokenIds[i];
            address tokenSeller = nftAddress.ownerOf(tokenId);
            require(msg.sender == tokenSeller, "caller is not token seller"); //함수 호출한 계정이 토큰소유자
            tokenPrice[tokenId] = 0;    // 판매가격 0으로 리셋 
        }
    }

}