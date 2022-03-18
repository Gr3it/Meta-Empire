// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MetaEmpires is ERC721, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;

    uint256 public immutable MAX_SUPPLY; // 4999
    uint256 public immutable MAX_MINT_PER_ADDRESS; // 2
    uint256 public immutable TEAM_RESERVED_MINT; // 50
    uint256 public immutable AUCTION_INTERVAL; // 20

    address private constant TEAM = 0x2F79c1ae4d60Bb2DfF0389782359E3676712e6E3;
    address private constant WALLET1 =
        0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2;
    address private constant WALLET2 =
        0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db;
    address private constant WALLET3 =
        0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB;
    address private constant WALLET4 =
        0x617F2E2fD72FD9D5503197092aC168c91465E7f2;

    bytes32 private root;

    Counters.Counter private _tokenIdCounter;

    mapping(address => uint256) public nbOfCEsMintedBy;
    mapping(uint256 => bool) public isStaked;

    uint256 public preSaleMintPrice;
    uint256 public preSaleStartTime;
    uint256 public preSaleDuration;

    uint256 public saleMintPrice;
    uint256 public saleStartTime;
    uint256 public saleDuration;
    uint256 public auctionPriceMultiplier;

    string private baseURI;

    constructor(
        uint256 _maxSupply,
        uint256 _maxMintPerAddress,
        uint256 _teamReservedMint,
        uint256 _auctionInterval
    ) ERC721("Crypto Empire", "EMPIRE") {
        MAX_SUPPLY = _maxSupply;
        MAX_MINT_PER_ADDRESS = _maxMintPerAddress;
        TEAM_RESERVED_MINT = _teamReservedMint;
        AUCTION_INTERVAL = _auctionInterval;
        _mintQuantity(TEAM_RESERVED_MINT);
    }

    event TokenStaked(uint256 indexed tokenId);
    event TokenUnStaked(uint256 indexed tokenId);

    modifier callerIsUser() {
        require(tx.origin == msg.sender, "The caller is another contract");
        _;
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString()))
                : "";
    }

    function walletOfOwner(address _owner)
        external
        view
        returns (uint256[] memory)
    {
        uint256 ownerTokenCount = balanceOf(_owner);
        uint256[] memory ownedTokenIds = new uint256[](ownerTokenCount);
        uint256 currentTokenId = 1;
        uint256 ownedTokenIndex = 0;

        while (
            ownedTokenIndex < ownerTokenCount && currentTokenId <= MAX_SUPPLY
        ) {
            address currentTokenOwner = ownerOf(currentTokenId);

            if (currentTokenOwner == _owner) {
                ownedTokenIds[ownedTokenIndex] = currentTokenId;

                ownedTokenIndex++;
            }

            currentTokenId++;
        }

        return ownedTokenIds;
    }

    function getAuctionPrice() public view returns (uint256) {
        if (block.timestamp < saleStartTime) {
            return saleMintPrice * auctionPriceMultiplier;
        }
        if (block.timestamp >= saleStartTime + saleDuration) {
            return saleMintPrice;
        }
        return
            (saleMintPrice * auctionPriceMultiplier) -
            ((((AUCTION_INTERVAL + 1) * (block.timestamp - saleStartTime)) /
                saleDuration) *
                (auctionPriceMultiplier - 1) *
                saleMintPrice) /
            AUCTION_INTERVAL;
    }

    function preSaleMintToken(uint256 _quantity, bytes32[] calldata _proof)
        external
        payable
        callerIsUser
    {
        require(
            preSaleStartTime != 0 && block.timestamp >= preSaleStartTime,
            "Pre sale not started yet"
        );
        require(
            block.timestamp <= preSaleStartTime + preSaleDuration,
            "Pre sale arledy ended"
        );
        require(
            _tokenIdCounter.current() + _quantity <= MAX_SUPPLY,
            "Mint quantity exceeds max supply"
        );
        require(
            nbOfCEsMintedBy[msg.sender] + _quantity <= MAX_MINT_PER_ADDRESS,
            "Mint quantity exceeds allowance for this address"
        );
        require(_quantity > 0, "Need to mint at least 1 NFT");
        require(_proof.length > 0, "Proof can't be empty");
        require(
            MerkleProof.verify(
                _proof,
                root,
                bytes32(abi.encodePacked(msg.sender))
            ),
            "User not whitelisted"
        );
        require(msg.value >= preSaleMintPrice * _quantity, "Price not met");

        _mintQuantity(_quantity);
    }

    function saleMintToken(uint256 _quantity) external payable callerIsUser {
        require(
            saleStartTime != 0 && block.timestamp >= saleStartTime,
            "Sale not started yet"
        );
        require(
            block.timestamp <= saleStartTime + saleDuration,
            "Sale arledy ended"
        );
        require(
            _tokenIdCounter.current() + _quantity <= MAX_SUPPLY,
            "Mint quantity exceeds max supply"
        );
        require(
            nbOfCEsMintedBy[msg.sender] + _quantity <= MAX_MINT_PER_ADDRESS,
            "Mint quantity exceeds allowance for this address"
        );
        require(_quantity > 0, "Need to mint at least 1 NFT");
        require(msg.value >= getAuctionPrice() * _quantity, "Price not met");

        _mintQuantity(_quantity);
    }

    function stakeNFT(uint256 tokenId) external {
        require(msg.sender == ownerOf(tokenId), "NFT not owned");
        isStaked[tokenId] = true;
        emit TokenStaked(tokenId);
    }

    function unStakeNFT(uint256 tokenId) external {
        require(msg.sender == ownerOf(tokenId), "NFT not owned");
        _unStakeNFT(tokenId);
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function setPreSale(
        uint256 _preSaleMintPrice,
        uint256 _preSaleStartTime,
        uint256 _preSaleDuration
    ) external onlyOwner {
        preSaleMintPrice = _preSaleMintPrice;
        preSaleStartTime = _preSaleStartTime;
        preSaleDuration = _preSaleDuration;
    }

    function setSale(
        uint256 _saleMintPrice,
        uint256 _saleStartTime,
        uint256 _saleDuration,
        uint256 _auctionPriceMultiplier
    ) external onlyOwner {
        saleMintPrice = _saleMintPrice;
        saleStartTime = _saleStartTime;
        saleDuration = _saleDuration;
        auctionPriceMultiplier = _auctionPriceMultiplier;
    }

    function setWhitelist(bytes32 _root) external onlyOwner {
        root = _root;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = TEAM.call{value: (balance * 3725) / 10000}("");
        require(success, "Withdrawal failed");
        (success, ) = WALLET1.call{value: (balance * 3725) / 10000}("");
        require(success, "Withdrawal failed");
        (success, ) = WALLET2.call{value: (balance * 1500) / 10000}("");
        require(success, "Withdrawal failed");
        (success, ) = WALLET3.call{value: (balance * 750) / 10000}("");
        require(success, "Withdrawal failed");
        (success, ) = WALLET4.call{value: (balance * 300) / 10000}("");
        require(success, "Withdrawal failed");
    }

    function _unStakeNFT(uint256 tokenId) internal {
        isStaked[tokenId] = false;
        emit TokenUnStaked(tokenId);
    }

    function _mintQuantity(uint256 _quantity) internal {
        for (uint256 i = 0; i < _quantity; i++) {
            _tokenIdCounter.increment();
            nbOfCEsMintedBy[msg.sender]++;
            _mint(msg.sender, _tokenIdCounter.current());
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );
        if (isStaked[tokenId] == true) {
            _unStakeNFT(tokenId);
        }
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        if (isStaked[tokenId] == true) {
            _unStakeNFT(tokenId);
        }
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public override {
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );
        if (isStaked[tokenId] == true) {
            _unStakeNFT(tokenId);
        }
        _safeTransfer(from, to, tokenId, _data);
    }
}
