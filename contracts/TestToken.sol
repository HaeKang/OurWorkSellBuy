pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

contract TestToken is ERC721Full{
  
  struct TestToken{
    string author;  // 만든사람
    string dateCreated; // 게시일
    string category;
  }
  mapping (uint256 => TestToken) Tests; // 토큰id와 유튜브섬네일 구조체 매핑
  mapping (string => uint256) videoIdsCreated;  // testId(작품아이디)와 토큰 매핑

  constructor(string memory name, string memory symbol) ERC721Full(name, symbol) public {}
  
  function mintYTT(
    string memory _workId,
    string memory _author,
    string memory _dateCreated,
    string memory _category,
    string memory _tokenURI // 토큰의 정보를 저장한 웹 주소
  )
  
  // 토큰 발행
    public 
  {
      // 유효성검사, 비디오아이디가 이미 있는지 확인
      require(videoIdsCreated[_workId] == 0, "videoId has already been created");
      uint256 tokenId = totalSupply().add(1); // totalSupply에 1을 더한 값이 tokenId
      
      Tests[tokenId] = TestToken(_author, _dateCreated, _category);
      videoIdsCreated[_workId] = tokenId;

      // 토큰 발행
      _mint(msg.sender, tokenId); 
      _setTokenURI(tokenId, _tokenURI);
  }

  // author와 date, 카테고리 불러옴
  function getYTT(uint256 _tokenId) public view returns(string memory, string memory, string memory){
    return (Tests[_tokenId].author, Tests[_tokenId].dateCreated, Tests[_tokenId].category);
  }

  // videoId가 사용됐었는지 확인, 0이 아니면 이미 사용됨(true) 0이면 사용안됨(false)
  function isTokenAlreadyCreated(string memory _workId) public view returns (bool){
    return videoIdsCreated[_workId] != 0 ? true : false;
  }
}