$deployer = "0x53F9f97FC5a193a424eB2C7cC39728E0161ff15f"
$sepoliaWeth = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
$baseSepoliaWeth = "0x4200000000000000000000000000000000000006"
$baseSepoliaChainlink = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1"

Write-Host "--------------------------------------------------"
Write-Host "Verifying Sepolia Contracts..."
Write-Host "--------------------------------------------------"

Write-Host "Verifying ChainlinkOracle (Sepolia)..."
npx hardhat verify --network sepolia --contract "src/oracles/ChainlinkOracle.sol:ChainlinkOracle" 0xbFb6a9e47be9ee806957C1FDd01CB32af9fA817A $deployer

Write-Host "Verifying OracleRouter (Sepolia)..."
npx hardhat verify --network sepolia 0x8A4143BCB631FcBE8cA7882736B039b9d681e5f1 $deployer

Write-Host "Verifying UniswapV3TWAPWrapper (Sepolia)..."
npx hardhat verify --network sepolia 0x31E905016774acd4E4eD38d2105394BB7cc48686 $deployer $sepoliaWeth

Write-Host "--------------------------------------------------"
Write-Host "Verifying Base Sepolia Contracts..."
Write-Host "--------------------------------------------------"

Write-Host "Verifying ChainlinkOracle (Base Sepolia)..."
npx hardhat verify --network baseSepolia --contract "src/oracles/ChainlinkOracle.sol:ChainlinkOracle" 0x0f408dd4037FB4ae39A21DFbFC23C0D6e0d62c7e $deployer

Write-Host "Verifying OracleRouter (Base Sepolia)..."
npx hardhat verify --network baseSepolia 0x761983518456d68ef3BD027A73b9d4b64D6B9346 $deployer

Write-Host "Verifying UniswapV3TWAPWrapper (Base Sepolia)..."
npx hardhat verify --network baseSepolia 0x8c709b0b1265D4904C0Cbfa5229d40550C2ea461 $deployer $baseSepoliaWeth

Write-Host "Verifying NFTOracle (Base Sepolia)..."
npx hardhat verify --network baseSepolia 0xA6Da6689353407D5eb17cD629B406D84f9Bc0739 $deployer $baseSepoliaChainlink
