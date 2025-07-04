---
title: End-to-end Transaction Example - LI.FI
url: https://docs.li.fi/introduction/user-flows-and-examples/
extractedAt: 2025-07-04T14:41:52.460Z
---

```

const { Contract } = require('ethers');

const ERC20_ABI = [
    {
        "name": "approve",
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "name": "allowance",
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Get the current allowance and update it if needed
const checkAndSetAllowance = async (wallet, tokenAddress, approvalAddress, amount) => {
    // Transactions with the native token don't need approval
    if (tokenAddress === ethers.constants.AddressZero) {
        return
    }

    const erc20 = new Contract(tokenAddress, ERC20_ABI, wallet);
    const allowance = await erc20.allowance(await wallet.getAddress(), approvalAddress);

    if (allowance.lt(amount)) {
        const approveTx = await erc20.approve(approvalAddress, amount);
        await approveTx.wait();
    }
}

await checkAndSetAllowance(wallet, quote.action.fromToken.address, quote.estimate.approvalAddress, fromAmount);


```