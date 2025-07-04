End-to-end Transaction Example - LI.FI

[LI.FI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/lifi/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/lifi/logo/dark.png)](/)

Search...

⌘KAsk AI

* [Playground](https://playground.li.fi/)
* [Support](https://lifihelp.zendesk.com/hc/en-us)
* [Get Started](https://portal.li.fi/signup)
* [Get Started](https://portal.li.fi/signup)

Search...

Navigation

User Flows and Examples

End-to-end Transaction Example

[Home](/home)[Introduction](/introduction/introduction)[API Reference](/api-reference/introduction)[SDK](/sdk/overview)[Widget](/widget/playground)[Guides and FAQs](/guides/fees-monetization/faq)[Changelog](/changelog/backend)

##### Learn About LI.FI

* [What is LI.FI?](/introduction/introduction)
* [Why LI.FI?](/introduction/why-lifi)
* [LI.FI vs Aggregators/DEXs/Bridges?](/introduction/lifi-vs-aggregators_dexs_bridges)
* [Powered by LI.FI](/introduction/powered-by-lifi)

##### Integrating LI.FI

* [Getting started](/introduction/integrating-lifi/getting-started)
* [Monetizing the integration](/introduction/integrating-lifi/monetizing-integration)
* [Chains](/introduction/chains)
* [Tools/Providers](/introduction/tools)
* [Partnership opportunities](/introduction/integrating-lifi/partnership-opportunities)

##### LI.FI Architecture

* [System Overview](/introduction/lifi-architecture/system-overview)
* [Smart Contract Overview](/introduction/lifi-architecture/smart-contract-overview)
* [Smart Contract Addresses](/introduction/lifi-architecture/smart-contract-addresses)
* [LI.Fuel Overview](/introduction/lifi-architecture/lifuel-overview)
* [Bitcoin Overview](/introduction/lifi-architecture/bitcoin-overview)
* [Solana Overview](/introduction/lifi-architecture/solana-overview)

##### User Flows and Examples

* [End-to-end Transaction Example](/introduction/user-flows-and-examples/end-to-end-example)
* [Fetching a Quote/Route](/introduction/user-flows-and-examples/requesting-route-fetching-quote)
* [Quote vs Route](/introduction/user-flows-and-examples/difference-between-quote-and-route)
* [Tx Batching aka "Zaps"](/introduction/user-flows-and-examples/tx-batching-aka-zaps)
* [Monetization](/introduction/user-flows-and-examples/monetization)
* [Solana transaction example](/introduction/user-flows-and-examples/solana-tx-execution)
* [Bitcoin transactoin example](/introduction/user-flows-and-examples/bitcoin-tx-example)
* [Transaction status tracking](/introduction/user-flows-and-examples/status-tracking)

##### Learn More

* [Security and Audits](/introduction/learn-more/security-and-audits)
* How to get integrated by LI.FI

User Flows and Examples

# End-to-end Transaction Example

Copy page

## [​](#step-by-step) Step by step

1

Requesting a quote or routes

TypeScript

Copy

Ask AI

```
const getQuote = async (fromChain, toChain, fromToken, toToken, fromAmount, fromAddress) => {
    const result = await axios.get('https://li.quest/v1/quote', {
        params: {
            fromChain,
            toChain,
            fromToken,
            toToken,
            fromAmount,
            fromAddress,
        }
    });
    return result.data;
}

const fromChain = 'DAI';
const fromToken = 'USDC';
const toChain = 'POL';
const toToken = 'USDC';
const fromAmount = '1000000';
const fromAddress = YOUR_WALLET_ADDRESS;

const quote = await getQuote(fromChain, toChain, fromToken, toToken, fromAmount, fromAddress);

```

2

Choose the desired route if `/routes` was used and retrieve transaction data from `/advanced/stepTransaction`

This step is only needed if `/routes` endpoint was used. `/quote` already returns the transaction data within the response. Difference between `/quote` and `/routes` is desribed [here](/introduction/user-flows-and-examples/difference-between-quote-and-route)

3

Setting the allowance

Before any transaction can be sent, it must be made sure that the user is allowed to send the requested amount from the wallet.

TypeScript

Copy

Ask AI

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

4

Sending the transaction

After receiving a quote, the transaction has to be sent to trigger the transfer.

Firstly, the wallet has to be configured. The following example connects your wallet to the Gnosis Chain.

TypeScript

Copy

Ask AI

```
const provider = new ethers.providers.JsonRpcProvider('https://rpc.xdaichain.com/', 100);
const wallet = ethers.Wallet.fromMnemonic(YOUR_PERSONAL_MNEMONIC).connect(
    provider
);

```

Afterward, the transaction can be sent using the `transactionRequest` inside the previously retrieved quote:

TypeScript

Copy

Ask AI

```
const tx = await wallet.sendTransaction(quote.transactionRequest);
await tx.wait();

```

5

Executing second step if applicable

If two-step route was used, the second step has to be executed after the first step is complete. Fetch the status of the first step like described in next step and then request transactionData from `/advanced/stepTransaction` endpoint.

6

Fetching the transfer status

To check if the token was successfully sent to the receiving chain, the /status endpoint can be called:

TypeScript

Copy

Ask AI

```
const getStatus = async (bridge, fromChain, toChain, txHash) => {
    const result = await axios.get('https://li.quest/v1/status', {
        params: {
            bridge,
            fromChain,
            toChain,
            txHash,
        }
    });
    return result.data;
}

result = await getStatus(quote.tool, fromChain, toChain, tx.hash);

```

## [​](#full-example) Full example

TypeScript

Copy

Ask AI

```
const ethers = require('ethers');
const axios = require('axios');

const API_URL = 'https://li.quest/v1';

// Get a quote for your desired transfer
const getQuote = async (fromChain, toChain, fromToken, toToken, fromAmount, fromAddress) => {
    const result = await axios.get(`${API_URL}/quote`, {
        params: {
            fromChain,
            toChain,
            fromToken,
            toToken,
            fromAmount,
            fromAddress,
        }
    });
    return result.data;
}

// Check the status of your transfer
const getStatus = async (bridge, fromChain, toChain, txHash) => {
    const result = await axios.get(`${API_URL}/status`, {
        params: {
            bridge,
            fromChain,
            toChain,
            txHash,
        }
    });
    return result.data;
}

const fromChain = 'DAI';
const fromToken = 'USDC';
const toChain = 'POL';
const toToken = 'USDC';
const fromAmount = '1000000';
const fromAddress = YOUR_WALLET_ADDRESS;

// Set up your wallet
const provider = new ethers.providers.JsonRpcProvider('https://rpc.xdaichain.com/', 100);
const wallet = ethers.Wallet.fromMnemonic(YOUR_PERSONAL_MNEMONIC).connect(
    provider
);

const run = async () => {
    const quote = await getQuote(fromChain, toChain, fromToken, toToken, fromAmount, fromAddress);
    const tx = await wallet.sendTransaction(quote.transactionRequest);

    await tx.wait();

    // Only needed for cross chain transfers
    if (fromChain !== toChain) {
        let result;
        do {
            result = await getStatus(quote.tool, fromChain, toChain, tx.hash);
        } while (result.status !== 'DONE' && result.status !== 'FAILED')
    }
}

run().then(() => {
    console.log('DONE!')
});

```

[Solana Overview](/introduction/lifi-architecture/solana-overview)[Fetching a Quote/Route](/introduction/user-flows-and-examples/requesting-route-fetching-quote)

On this page

* [Step by step](#step-by-step)
* [Full example](#full-example)

[LI.FI home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/lifi/logo/light.png)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/lifi/logo/dark.png)](/)

[x](https://x.com/lifiprotocol)[github](https://github.com/lifinance)[website](https://li.fi/)

Company

[Careers](https://li.fi/careers/)[Brand Assets](https://li.fi/brand-assets/)[About](https://li.fi/)

Tools

[LI.FI Explorer](https://explorer.li.fi/?utm_source=lifi&utm_medium=footer_link_tools&utm_campaign=lifi_to_explorer)

Legal

[Privacy Policy](https://li.fi/legal/privacy-policy/)[Terms of Service](https://li.fi/legal/terms-and-conditions/)[Imprint](https://li.fi/legal/imprint/)

[x](https://x.com/lifiprotocol)[github](https://github.com/lifinance)[website](https://li.fi/)

[Powered by Mintlify](https://mintlify.com/preview-request?utm_campaign=poweredBy&utm_medium=referral&utm_source=docs.li.fi)

Assistant

Responses are generated using AI and may contain mistakes.