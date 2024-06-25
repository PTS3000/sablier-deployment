            // SPDX-License-Identifier: GPL-3.0-or-later
            pragma solidity >=0.8.19;

            import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
            import { ud60x18 } from "@prb/math/src/UD60x18.sol";
            import { ISablierV2LockupLinear } from "@sablier/v2-core/src/interfaces/ISablierV2LockupLinear.sol";
            import { Broker, LockupLinear } from "@sablier/v2-core/src/types/DataTypes.sol";

            contract LockupLinearStreamCreator {
                // Mainnet addresses
                IERC20 public constant TOKEN = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
                ISablierV2LockupLinear public constant LOCKUP_LINEAR =
                    ISablierV2LockupLinear(0xFCF737582d167c7D20A336532eb8BCcA8CF8e350);

                function createStream(uint128 totalAmount) public returns (uint256 streamId) {
                    // Transfer the provided amount of TOKEN tokens to this contract
                    TOKEN.transferFrom(msg.sender, address(this), totalAmount);

                    // Approve the Sablier contract to spend TOKEN
                    TOKEN.approve(address(LOCKUP_LINEAR), totalAmount);

                    // Declare the params struct
                    LockupLinear.CreateWithRange memory params;

                    // Declare the function parameters
                    params.sender = msg.sender; // The sender will be able to cancel the stream
                    params.recipient = address(0x03ae395d04D1dE1A34F1bF6Ef86Ac53D9b35D41a); // The recipient of the streamed assets
                    params.totalAmount = 2000000; // Total amount is the amount inclusive of all fees
                    params.asset = TOKEN; // The streaming asset
                    params.cancelable = true; // Whether the stream will be cancelable or not
                    params.transferable = false; // Whether the stream will be transferable or not
                    params.range = LockupLinear.Range({
                        start: 1722466800, // Assets will be unlocked from this time
                        cliff: 1754026992, // End of cliffing period
                        end: 1818370800 // End time in Unix timestamp
                    });

                    streamId = LOCKUP_LINEAR.createWithRange(params);
                }
            }
            