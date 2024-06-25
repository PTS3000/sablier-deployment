            // SPDX-License-Identifier: GPL-3.0-or-later
            pragma solidity >=0.8.19;

            import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
            import { ud2x18 } from "@prb/math/src/UD2x18.sol";
            import { ud60x18 } from "@prb/math/src/UD60x18.sol";
            import { ISablierV2LockupDynamic } from "@sablier/v2-core/src/interfaces/ISablierV2LockupDynamic.sol";
            import { Broker, LockupDynamic } from "@sablier/v2-core/src/types/DataTypes.sol";

            contract LockupDynamicCurvesCreator {
                // Mainnet addresses
                IERC20 public constant TOKEN = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
                ISablierV2LockupDynamic public constant LOCKUP_DYNAMIC =
                    ISablierV2LockupDynamic(0x461E13056a3a3265CEF4c593F01b2e960755dE91);

                function createStream_Timelock() external returns (uint256 streamId) {
                    uint128 totalAmount = 1000;

                    // Transfer the provided amount of TOKEN tokens to this contract
                    TOKEN.transferFrom(msg.sender, address(this), totalAmount);

                    // Approve the Sablier contract to spend TOKEN
                    TOKEN.approve(address(LOCKUP_DYNAMIC), totalAmount);

                    // Declare the params struct
                    LockupDynamic.CreateWithMilestones memory params;

                    // Declare the function parameters
                    params.sender = msg.sender; // The sender will be able to cancel the stream
                    params.recipient = 0xf924efc8830bfA1029fA0cd7a51901a5EC03DE3d; // The recipient of the streamed assets
                    params.startTime = 1722466800; // Start time in Unix timestamp
                    params.totalAmount = totalAmount; // Total amount is the amount inclusive of all fees
                    params.asset = TOKEN; // The streaming asset
                    params.cancelable = false; // Whether the stream will be cancelable or not
                    params.transferable = false; // Whether the stream will be transferable or not

                    // Declare a two-size segment to match the curve shape
                    params.segments = new LockupDynamic.Segment ;
                    params.segments[0] = LockupDynamic.Segment({
                        amount: 0, 
                        exponent: ud2x18(1e18),
                        milestone: 1722466801 
                    });
                    params.segments[1] = LockupDynamic.Segment({
                        amount: 1000e18, 
                        exponent: ud2x18(1e18),
                        milestone: 1722466802 
                        
                    });

                    // Create the LockupDynamic stream
                    streamId = LOCKUP_DYNAMIC.createWithMilestones(params);
                }
            }
            