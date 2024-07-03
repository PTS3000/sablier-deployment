const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Define the structure for Batch.CreateWithRange
class LockupLinearRange {
    /**
     * Creates an instance of LockupLinearRange.
     * @param {number} start - The start time in Unix timestamp.
     * @param {number} cliff - The cliff time in Unix timestamp.
     * @param {number} end - The end time in Unix timestamp.
     */
    constructor(start, cliff, end) {
        this.start = start;
        this.cliff = cliff;
        this.end = end;
    }
}

class BatchCreateWithRange {
    /**
     * Creates an instance of BatchCreateWithRange.
     * @param {string} sender - The address of the sender.
     * @param {string} recipient - The address of the recipient.
     * @param {number} totalAmount - The total amount to be locked up.
     * @param {string} asset - The address of the asset.
     * @param {boolean} cancelable - Whether the contract is cancelable.
     * @param {boolean} transferable - Whether the contract is transferable.
     * @param {LockupLinearRange} range - The range object containing start, cliff, and end times.
     */
    constructor(sender, recipient, totalAmount, asset, cancelable, transferable, range) {
        this.sender = sender;
        this.recipient = recipient;
        this.totalAmount = totalAmount;
        this.asset = asset;
        this.cancelable = cancelable;
        this.transferable = transferable;
        this.range = range;
    }
}

const privateKey = '12f23a131783385a50219e2e473218362acda165ac5f6d96ad1442722c066a71';
const account = ethers.utils.getAddress('0x389431E8Bc3a5159895dc95D91C34A3457089591');
const contractAddress = '0x94E596EEd73b4e3171c067f05A87AB0268cA993c';

// Function to parse Solidity file and extract parameters
function parseSolidityFile(filePath) {
    /**
     * Parses a Solidity file to extract contract parameters.
     * @param {string} filePath - Path to the Solidity file.
     * @returns {Object} An object containing extracted parameters.
     */
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`Parsing file: ${filePath}`);
    const params = {};

    // Extract the parameters using regex
    try {
        params.sender = account;
        if (!ethers.utils.isAddress(params.sender)) {
            throw new Error(`Invalid sender address: ${params.sender}`);
        }
        console.log(`Found sender: ${params.sender}`);

        const recipientMatch = content.match(/params\.recipient\s*=\s*address\((0x[0-9a-fA-F]+)\);/);
        if (recipientMatch) {
            params.recipient = recipientMatch[1];
            if (!ethers.utils.isAddress(params.recipient)) {
                throw new Error(`Invalid recipient address: ${params.recipient}`);
            }
            console.log(`Found recipient: ${params.recipient}`);
        } else {
            throw new Error("Could not match the recipient in the Solidity file.");
        }

        params.totalAmount = parseInt(content.match(/params\.totalAmount\s*=\s*(.*);/)[1].trim());
        console.log(`Found totalAmount: ${params.totalAmount}`);

        const assetMatch = content.match(/IERC20\((0x[0-9a-fA-F]+)\)/);
        if (assetMatch) {
            params.asset = assetMatch[1];
            if (!ethers.utils.isAddress(params.asset)) {
                throw new Error(`Invalid asset address: ${params.asset}`);
            }
            console.log(`Found asset: ${params.asset}`);
        } else {
            throw new Error("Could not match the asset in the Solidity file.");
        }

        params.cancelable = content.match(/params\.cancelable\s*=\s*(.*);/)[1].trim().toLowerCase() === 'true';
        console.log(`Found cancelable: ${params.cancelable}`);

        params.transferable = content.match(/params\.transferable\s*=\s*(.*);/)[1].trim().toLowerCase() === 'true';
        console.log(`Found transferable: ${params.transferable}`);

        // Extract range parameters directly
        const startMatch = content.match(/start:\s*(\d+)/);
        const cliffMatch = content.match(/cliff:\s*(\d+)/);
        const endMatch = content.match(/end:\s*(\d+)/);

        if (startMatch && cliffMatch && endMatch) {
            params.range = new LockupLinearRange(
                parseInt(startMatch[1]),
                parseInt(cliffMatch[1]),
                parseInt(endMatch[1])
            );
            console.log(`Found range: start=${params.range.start}, cliff=${params.range.cliff}, end=${params.range.end}`);
        } else {
            throw new Error("Could not match the range parameters in the Solidity file.");
        }
    } catch (e) {
        console.error(`Error parsing file ${filePath}: ${e}`);
        throw e;
    }

    return params;
}

// Function to create batch of CreateWithRange objects
function createBatchFromFiles(files) {
    /**
     * Creates a batch of BatchCreateWithRange objects from a list of Solidity files.
     * @param {Array<string>} files - List of paths to Solidity files.
     * @returns {Array<BatchCreateWithRange>} A list of BatchCreateWithRange objects.
     */
    const batch = [];
    for (const filePath of files) {
        try {
            const params = parseSolidityFile(filePath);
            batch.push(new BatchCreateWithRange(
                params.sender,
                params.recipient,
                params.totalAmount,
                params.asset,
                params.cancelable,
                params.transferable,
                params.range
            ));
        } catch (e) {
            console.error(`Skipping file ${filePath} due to error: ${e}`);
        }
    }
    return batch;
}

// Directory containing Solidity files
const solidityFilesDirectory = 'contracts/linear_lockup/';

// Get list of all Solidity files in the directory
const solidityFiles = fs.readdirSync(solidityFilesDirectory).filter(f => f.endsWith('.sol')).map(f => path.join(solidityFilesDirectory, f));

// Create batch from Solidity files
const batch = createBatchFromFiles(solidityFiles);

// Example of how to pass the batch to the createWithRange function
for (const b of batch) {
    console.log(`Sender: ${b.sender}, Recipient: ${b.recipient}, TotalAmount: ${b.totalAmount}, Asset: ${b.asset}, Cancelable: ${b.cancelable}, Transferable: ${b.transferable}, Range: (${b.range.start}, ${b.range.cliff}, ${b.range.end})`);
}

// Connect to the Base blockchain using QuickNode
const provider = new ethers.providers.JsonRpcProvider('https://wild-nameless-sheet.base-sepolia.quiknode.pro/6fbb48054c8a584d38a44ffbcef70f6e78ccd53d/');

// Load contract ABI from a file
const contractAbi = JSON.parse(fs.readFileSync('abi.json', 'utf8'));

// Instantiate the contract
const contract = new ethers.Contract(contractAddress, contractAbi, provider);

// Verify if the function exists
if (contract.functions.createWithRange) {
    console.log("The function createWithRange exists in the contract.");
} else {
    console.log("The function createWithRange does not exist in the contract.");
    process.exit(1);
}

// Function to call createWithRange
async function callCreateWithRange(batch, contract) {
    /**
     * Calls the createWithRange function on the contract with the given batch of parameters.
     * @param {Array<BatchCreateWithRange>} batch - The batch of parameters.
     * @param {ethers.Contract} contract - The instantiated contract object.
     * @returns {Object} The transaction receipt.
     */
    console.log("Initializing wallet...");
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("Preparing batch data...");
    // Prepare batch data
    const batchData = batch.map(item => ({
        sender: item.sender,
        recipient: ethers.utils.getAddress(item.recipient),
        totalAmount: item.totalAmount,
        asset: ethers.utils.getAddress(item.asset),
        cancelable: item.cancelable,
        transferable: item.transferable,
        range: {
            start: item.range.start,
            cliff: item.range.cliff,
            end: item.range.end
        },
        broker: {
            account: ethers.utils.getAddress(account), // Ensure this is set correctly
            fee: ethers.utils.parseUnits('0', 'ether')
        }
    }));

    console.log("Batch data prepared:", batchData);

    try {
        console.log("Getting nonce for wallet...");
        // Build the transaction
        const nonce = await wallet.getTransactionCount();
        console.log("Nonce obtained:", nonce);

        console.log("Populating transaction...");
        const txn = await contract.populateTransaction.createWithRange(
            ethers.utils.getAddress(contractAddress), // lockupLinear address
            ethers.utils.getAddress(batch[0].asset), // Assuming all assets are the same
            batchData,
            {
                gasLimit: 2000000,
                gasPrice: ethers.utils.parseUnits('50', 'gwei'),
                nonce: nonce
            }
        );

        txn.chainId = 84532;

        console.log("Transaction populated:", txn);

        console.log("Signing transaction...");
        // Sign the transaction
        const signedTxn = await wallet.signTransaction(txn);
        console.log("Transaction signed:", signedTxn);

        console.log("Sending transaction...");
        // Send the transaction
        const tx = await provider.sendTransaction(signedTxn);
        console.log("Transaction sent, waiting for receipt...");

        // Wait for the transaction receipt
        const receipt = await tx.wait();
        console.log("Transaction receipt obtained:", receipt);
        return receipt;
    } catch (error) {
        console.error("Error in callCreateWithRange:", error);
        throw error;
    }
}

// Call the function to create the range
callCreateWithRange(batch, contract).then(receipt => {
    console.log(`Transaction receipt: ${JSON.stringify(receipt)}`);
}).catch(error => {
    console.error(`Error calling createWithRange: ${error}`);
});
