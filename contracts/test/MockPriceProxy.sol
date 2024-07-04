// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../oracle/price-proxy-impl/AbstractPriceProxy.sol";

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MockPriceProxy is AbstractPriceProxy {

    mapping (string => Price) public priceMap;

    constructor(address _oracle) AbstractPriceProxy(_oracle) {
    }

    /// @notice                     Gets the feed id of the token price by price pair name
    /// @dev                        The feed id is defined by the third-party oracle
    /// @return feedId              The feed id of the token price
    function getFeedId(
        string memory
    ) external override pure returns(bytes32 feedId) {
        return bytes32(0);
    }

    function setPrice(
        string memory _pairName,
        uint _price,
        uint32 _decimals,
        uint _diffTime
        ) external nonEmptyPairName(_pairName) onlyOwner {
        require(_price > 0, "MockPriceProxy: price is invalid");
        require(_decimals > 0, "MockPriceProxy: decimals is invalid");

        Price storage price = priceMap[_pairName];
        price.price = _price;
        price.decimals = _decimals;
        price.publishTime = block.timestamp - _diffTime;
    }

    /// @notice                     Gets the EMA price of the token by pair name
    /// @param _pairName            The price pair name (e.g. CORE/USDT  BTC/USDT)
    /// @return price               The EMA price of the price pair
    /// @return err                 Error message
    function _getEmaPriceByPairName(
        string memory _pairName
    ) internal view override returns(Price memory price, string memory err) {
        price = priceMap[_pairName];
    }
}