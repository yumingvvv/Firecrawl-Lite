---
title: What is LI.FI? - LI.FI
url: https://docs.li.fi/introduction/introduction
extractedAt: 2025-07-04T13:24:43.224Z
---

## Overview


LI.FI is a multi-chain liquidity aggregator that combines three types of liquidity sources: DEX aggregators, solvers, and cross-chain bridges. It streamlines the trading process by providing a comprehensive order routing, saving you the time and effort required for research, integration, and maintenance.

**DEX Aggregators**: Aggregate data from decentralized exchanges (DEXs), which use on-chain price functions for asset pairs in liquidity pools. DEX aggregators compute prices using this data to minimize slippage.

**Solvers:** Similar to DEX aggregators but utilize more complex on-chain liquidity sources (e.g., lending protocols or token minting/burning) to achieve better pricing. These operations may take longer due to the additional computations.

**Bridges:** Facilitate cross-chain transfers using single-asset liquidity pools on multiple chains, with pricing determined via an API rather than on-chain. Most bridges operate using a lock-and-release mechanism to transfer assets between chains.

![LI.FI Overview](https://mintlify.s3.us-west-1.amazonaws.com/lifi/images/lifi-overview.avif)