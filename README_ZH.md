# @okxweb3/hardhat-explorer-verify

[English](./README.md)
[Chinese](./README_ZH.md)

## 插件的背景

`@okxweb3/hardhat-explorer-verify` 是一个为Hardhat框架设计的插件，用于验证部署在OKX Chain XLayer上的智能合约。该插件专注于合约代码的验证，确保部署后的合约代码与源代码完全匹配，从而增强智能合约的透明度和信任度。用户可以通过此插件在OKX Chain区块链浏览器上验证他们的合约，而无需手动提交验证。

## Features

- **自动化验证**: 简化验证流程，自动从Hardhat项目中提取合约信息并提交到OKX Chain浏览器。
- **安全性**: 确保部署的合约与源代码完全一致，增强合约安全性。
- **简单易用**: 集成简洁，只需少量配置即可启动和运行。

## Installation

在您的Hardhat项目中安装此插件，可以通过以下命令：

```bash
npm install @okxweb3/hardhat-explorer-verify
```

## Usage

1. **安装插件**: 如安装部分所述，首先需要在您的项目中安装`@okxweb3/hardhat-explorer-verify`插件。

2. **配置Hardhat**: 在Hardhat配置文件（通常是`hardhat.config.js`或`hardhat.config.ts`）中，引入并配置插件。确保您的网络配置和API密钥正确。

   下面是一个示例配置：

   ```javascript
   import { HardhatUserConfig } from "hardhat/config";
   import "@nomicfoundation/hardhat-toolbox";
   import '@okxweb3/hardhat-explorer-verify';  // 引入插件

   const config: HardhatUserConfig = {
     solidity: "0.8.24",
     sourcify: {
       enabled: true,
     },
     networks: {
       xlayer: {
         url: "https://xlayerrpc.example.com",
         accounts: ["<您的钱包私钥>"],
       },
     },
     etherscan: {
        apiKey: '...'
     },
     okxweb3explorer: {
       apiKey: "<您的API密钥>",
     }
   };

   export default config;
   ```

3. **验证合约**: 在部署合约后，使用Hardhat运行验证脚本。这通常涉及运行一个特定的Hardhat任务，该任务将自动抓取合约数据并发送到OKX Chain浏览器进行验证。

   示例命令如下：

   ```bash
   npx hardhat okverify --network xlayer <您的合约地址>
   ```

4. **查看验证结果**: 验证成功后，您可以在OKX Chain区块链浏览器中查看验证状态和合约代码。
![deploy](./public/deploy.png)


5. **验证代理合约**

示例命令如下：
```bash
npx hardhat okverify --network xlayer --contract <Contract>:<Name> --proxy <address>
```

- `--proxy`: 提示地址是代理地址

这个文档旨在帮助开发者更有效地使用`@okxweb3/hardhat-explorer-verify`插件。如有疑问或需要进一步帮助，欢迎提交问题到项目的GitHub仓库。