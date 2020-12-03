import {ethers} from 'ethers';
import Biconomy from './Biconomy';
import {feeProxyAbi,oracleAggregatorAbi,feeManagerAbi,forwarderAbi,daiAbi,erc20Eip2612Abi,transferHandlerAbi} from './abis';

const domainType = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" }
  ];
  
const daiPermitType = [
    { name: "holder", type: "address" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "allowed", type: "bool" }
  ];

const eip2612PermitType = [
    { name: "owner", type: "address"},
    { name: "spender", type: "address"},
    { name: "value", type: "uint256"},
    { name: "nonce", type: "uint256"},
    { name: "deadline", type: "uint256"}
  ];

const erc20ForwardRequestType = [
    {name:'from',type:'address'},
    {name:'to',type:'address'},
    {name:'token',type:'address'},
    {name:'txGas',type:'uint256'},
    {name:'tokenGasPrice',type:'uint256'},
    {name:'batchId',type:'uint256'},
    {name:'batchNonce',type:'uint256'},
    {name:'deadline',type:'uint256'},
    {name:'dataHash',type:'bytes32'}
];

function getFetchOptions(method, apiKey) {
	return {
		method: method,
		headers: {
			"x-api-key" : apiKey,
			'Content-Type': 'application/json;charset=utf-8'
		}
	}
}


const getGasPrice = async() => {
    const response = await fetch("https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=P7JFS2YI6MNZFVY95FDMV45EGIX6F1BPAV");
    const responseJson = await response.json();
    console.log("Response JSON "+ JSON.stringify(responseJson));
    return (ethers.utils.parseUnits(responseJson.result.FastGasPrice,"gwei")).toString();
}

class ERC20ForwarderClient{

  constructor(biconomy,signer,feeProxyDomainData,oracleAggregatorAddress,feeManagerAddress,forwarderAddress,transferHandlerAddress){
    this.biconomy = biconomy;
    this.signer = signer;
    this.feeProxy = new ethers.Contract(feeProxyDomainData.verifyingContract,feeProxyAbi,signer);
    this.feeProxyDomainData = this.feeProxyDomainData;
    this.oracleAggregator = new ethers.Contract(oracleAggregatorAddress,oracleAggregatorAbi,signer);
    this.feeManager = new ethers.Contract(feeManagerAddress,feeManagerAbi,signer);
    this.forwarder = new ethers.Contract(forwarderAddress,forwarderAbi,signer);
    this.transferHandler = new ethers.contract(transferHandlerAddress,transferHandlerAbi,signer);
  }

  static async factory(provider,feeProxyDomainData,transferHandlerAddress,BiconomyOptions){
    const originalProvider = new ethers.providers.Web3Provider(provider);
    const signer = originalProvider.getSigner();
    //const signer = await biconomyProvider.getSigner();
    const feeProxy = new ethers.Contract(feeProxyDomainData.verifyingContract,feeProxyAbi,signer);
    const oracleAggregatorAddress = await feeProxy.oracleAggregator();
    const feeManagerAddress = await feeProxy.feeManager();
    const forwarderAddress = await feeProxy.forwarder();
    //biconomy object will contain apiKey data

    const dappAPIMap = {};
    const getAPIInfoAPI = `${baseURL}/api/${config.version}/meta-api`;
    fetch(getAPIInfoAPI, getFetchOptions('GET', BiconomyOptions.apiKey))
    .then(response => response.json())
    .then(function(response) {
      if(response && response.listApis) {
			  let apiList = response.listApis;
			  for(let i=0;i<apiList.length;i++) {
				  let contractAddress = apiList[i].contractAddress;
					if(!dappAPIMap[contractAddress]) {
            dappAPIMap[contractAddress] = {};
					}
					dappAPIMap[contractAddress][apiList[i].method] = apiList[i];
			  }
		}
	}).catch(function(error) {
      _logMessage(error);
    });

    const biconomy = {apiKey:BiconomyOptions.apiKey,dappAPIMap:dappAPIMap};
    //find out ApiKey information here if possible
    return new ERC20ForwarderHelper(biconomy,signer,signerAddress,feeProxyDomainData,oracleAggregatorAddress,feeManagerAddress,forwarderAddress,transferHandlerAddress);
  }

  async getApiId(req){
    // get first 4 bytes from req data
    // 
  }

  async getTokenGasPrice(tokenAddress){
    const gasPrice = ethers.BigNumber.from(await getGasPrice());
    const tokenPrice = await this.oracleAggregator.getTokenPrice(tokenAddress);
    const tokenOracleDecimals = await this.oracleAggregator.getTokenOracleDecimals(tokenAddress);
    return ((gasPrice.mul((ethers.BigNumber.from(10)).pow(tokenOracleDecimals))).div(tokenPrice)).toString();
  }

  async daiPermit(tokenDomainData,spender,expiry,allowed){
    const dai = new ethers.contract(tokenDomainData.verifyingContract,daiAbi,this.signer);
    const userAddress = await (this.signer).getAddress();
    const nonce = await this.token.nonces(userAddress);
    const permitDataToSign = {
      types: {
            EIP712Domain: domainType,
            Permit: permitType
        },
        domain: tokenDomainData,
        primaryType: "Permit",
        message: {
            holder : userAddress,
            spender : spender,
            nonce: nonce.toString(),
            expiry: expiry,
            allowed: allowed
        }
      };
    const result = await this.signer.send("eth_signTypedData_v4",[userAddress,JSON.stringify(permitDataToSign)]);
    console.log("success",result);
    const signature = result.substring(2);
    const r = "0x" + signature.substring(0, 64);
    const s = "0x" + signature.substring(64, 128);
    const v = parseInt(signature.substring(128, 130), 16);
    await dai.permit(this.signerAddress,spender,nonce,expiry,allowed,v,r,s);
  }

  async eip2612Permit(tokenDomainData,spender,value,deadline){
    const token = new ethers.contract(tokenDomainData.verifyingContract,erc20Eip2612Abi,this.signer);
    const nonce = await this.token.nonces(userAddress);
    const permitDataToSign = {
        types: {
            EIP712Domain: domainType,
            Permit: permitType
        },
        domain: tokenDomainData,
        primaryType: "Permit",
        message: {
            holder : this.signerAddress,
            spender : spender,
            nonce: nonce.toString(),
            value: value,
            deadline: deadline
        }
      };
    const result = await this.signer.send("eth_signTypedData_v4",[userAddress,JSON.stringify(permitDataToSign)]);
    console.log("success",result);
    const signature = result.substring(2);
    const r = "0x" + signature.substring(0, 64);
    const s = "0x" + signature.substring(64, 128);
    const v = parseInt(signature.substring(128, 130), 16);
    await token.permit(this.signerAddress,spender,value,deadline,v,r,s);
  }

  async buildTx(to, token, txGas, deadline, data, newBatch=false){
    const batchId = newBatch ? await forwarder.getBatch(userAddress):0;
    const req = {
      from : this.signerAddress,
      to : to,
      token : token,
      txGas : txGas,
      tokenGasPrice : await this.getTokenGasPrice(token),
      batchId : batchId,
      batchNonce : (await forwarder.getNonce(userAddress,batchId)).toNumber(),
      deadline : deadline,
      data : data
    };
    
    const feeMultiplier = await this.feeManager.getFeeMultiplier(this.signerAddress,token);
    const cost = (req.txGas+await this.feeProxy.transferHandlerGas())*req.tokenGasPrice*feeMultiplier;

    return {request:req,cost:cost};

  }

  async buildTransferTx(to,token,amount,deadline){
    //should have call to check if user approved transferHandler
    const txCall = await this.transferHandler.populateTransaction.transfer(token,to,amount);
    return await buildTx(this.transferHandler.address,token,100000,txCall.data);
  }

  async sendTxEIP712(req){
    //should have call to check if user approved transferHandler
    const domainSeparator = ethers.utils.keccak256((ethers.utils.defaultAbiCoder).
        encode(['bytes32','bytes32','bytes32','uint256','address'],
               [ethers.utils.id("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
               ethers.utils.id(feeProxyDomainData.name),ethers.utils.id(feeProxyDomainData.version),
               feeProxyDomainData.chainId,feeProxyDomainData.verifyingContract]));

    const erc20fr = Object.assign({}, req);
    erc20fr.dataHash = ethers.utils.keccak256(erc20fr.data);
    delete erc20fr.data;
    const dataToSign = {
      types: {
          EIP712Domain: domainType,
          ERC20ForwardRequest: erc20ForwardRequestType
        },
        domain: feeProxyDomainData,
        primaryType: "ERC20ForwardRequest",
        message: erc20fr
      };

    const sig = await this.signer.send("eth_signTypedData_v4",[req.from,JSON.stringify(dataToSign)]);
    //get function signature from req.data (first 4 bytes)
    //replace with API call via fetch
    const apiId = this.getApiId(req);
    const body = {to:(this.feeProxy).address,from:this.signer,apiId:apiId,
                  params:[req,domainSeparator,sig]}
    const biconomy = await fetch("https://api.biconomy.io/api/v2/meta-tx/native",
                  {
                  method:'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': this.biconomy.apiKey
                  },
                  body:JSON.stringify(metaTxBody)
                  });
    const responseJson = await biconomy.json();
    return responseJson['txHash'];
    //await this.feeProxy.executeEIP712(req,domainSeparator,sig);
  }

  async sendTxPersonalSign(req){
    const hashToSign = abi.soliditySHA3(['address','address','address','uint256','uint256','uint256','uint256','uint256','bytes32'],
                                                [req.from,req.to,req.token,req.txGas,req.tokenGasPrice,req.batchId,req.batchNonce,req.deadline,
                                                    ethers.utils.keccak256(req.data)]);
    const sig = this.signer.signMessage(hashToSign);
    const apiId = this.getApiId(req);
    const body = {to:(this.feeProxy).address,from:this.signer,apiId:apiId,
      params:[req,sig]}
    const biconomy = await fetch("https://api.biconomy.io/api/v2/meta-tx/native",
      {
      method:'POST',
      headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.biconomy.apiKey
      },
      body:JSON.stringify(metaTxBody)
      });
    const responseJson = await biconomy.json();
    return responseJson['txHash'];
    //await this.feeProxy.executePersonalSign(req,domainSeparator,sig,{});
  }

  getApiId(req){
    //get functionSignature & contract
    //
  }



}

export default ERC20ForwarderClient;