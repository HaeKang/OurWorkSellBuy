pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

contract YouTubeThumbnailToken is ERC721Full{
  
  struct YouTubeThumbnail{
    string author;  // 썸네일 만든사람
    string dateCreated; // 게시정보
  }
  mapping (uint256 => YouTubeThumbnail) youTubeThumbnails; // 토큰id와 유튜브섬네일 구조체 매핑
  mapping (string => uint256) videoIdsCreated;  // videoId와 토큰 매핑

  constructor(string memory name, string memory symbol) ERC721Full(name, symbol) public {}
  
  function mintYTT(
    string memory _videoId,
    string memory _author,
    string memory _dateCreated,
    string memory _tokenURI // 토큰의 정보를 저장한 웹 주소
  )
  
  // 토큰 발행
    public 
  {
      // 유효성검사, 비디오아이디가 이미 있는지 확인
      require(videoIdsCreated[_videoId] == 0, "videoId has already been created");
      uint256 tokenId = totalSupply().add(1); // totalSupply에 1을 더한 값이 tokenId
      youTubeThumbnails[tokenId] = YouTubeThumbnail(_author, _dateCreated);
      videoIdsCreated[_videoId] = tokenId;

      // 토큰 발행
      _mint(msg.sender, tokenId); 
      _setTokenURI(tokenId, _tokenURI);
  }

  // author와 date 불러옴
  function getYTT(uint256 _tokenId) public view returns(string memory, string memory){
    return (youTubeThumbnails[_tokenId].author, youTubeThumbnails[_tokenId].dateCreated);
  }

  // videoId가 사용됐었는지 확인, 0이 아니면 이미 사용됨(true) 0이면 사용안됨(false)
  function isTokenAlreadyCreated(string memory _videoId) public view returns (bool){
    return videoIdsCreated[_videoId] != 0 ? true : false;
  }
}