const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Define the structure for Batch.CreateWithMilestones
class LockupDynamicSegment {
    constructor(amount, exponent, milestone) {
        this.amount = amount;
        this.exponent = exponent;
        this.milestone = milestone;
    }
}

class LockupDynamicCreateWithMilestones {
    constructor(sender, startTime, cancelable, transferable, recipient, totalAmount, asset, broker, segments) {
        this.sender = sender;
        this.startTime = startTime;
        this.cancelable = cancelable;
        this.transferable = transferable;
        this.recipient = recipient;
        this.totalAmount = totalAmount;
        this.asset = asset;
        this.broker = broker;
        this.segments = segments;
    }
}

const privateKey = '12f23a131783385a50219e2e473218362acda165ac5f6d96ad1442722c066a71';
const account = ethers.utils.getAddress('0x389431E8Bc3a5159895dc95D91C34A3457089591');
const contractAddress = '0x94E596EEd73b4e3171c067f05A87AB0268cA993c';

// Function to parse Solidity file and extract parameters
function parseSolidityFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`Parsing file: ${filePath}`);
    const params = {};

    try {
        params.sender = account;
        if (!ethers.utils.isAddress(params.sender)) {
            throw new Error(`Invalid sender address: ${params.sender}`);
        }
        console.log(`Found sender: ${params.sender}`);
        
        const recipientMatch = content.match(/params\.recipient\s*=\s*0x([0-9a-fA-F]+);/);
        if (recipientMatch) {
            params.recipient = '0x' + recipientMatch[1];
            console.log(`Found recipient: ${params.recipient}`);
        } else {
            throw new Error("Could not match the recipient in the Solidity file.");
        }

        const startTimeMatch = content.match(/params\.startTime\s*=\s*(\d+);/);
        if (startTimeMatch) {
            params.startTime = parseInt(startTimeMatch[1].trim());
            console.log(`Found startTime: ${params.startTime}`);
        } else {
            throw new Error("Could not match the startTime in the Solidity file.");
        }

        const totalAmountMatch = content.match(/totalAmount\s*=\s*(\d+);/);
        if (totalAmountMatch) {
            params.totalAmount = parseInt(totalAmountMatch[1].trim());
            console.log(`Found totalAmount: ${params.totalAmount}`);
        } else {
            throw new Error("Could not match the totalAmount in the Solidity file.");
        }

        const assetMatch = content.match(/IERC20\((0x[0-9a-fA-F]+)\)/);
        if (assetMatch) {
            params.asset = assetMatch[1];
            console.log(`Found asset: ${params.asset}`);
        } else {
            throw new Error("Could not match the asset in the Solidity file.");
        }

        params.cancelable = content.match(/params\.cancelable\s*=\s*(.*);/)[1].trim().toLowerCase() === 'true';
        console.log(`Found cancelable: ${params.cancelable}`);

        params.transferable = content.match(/params\.transferable\s*=\s*(.*);/)[1].trim().toLowerCase() === 'true';
        console.log(`Found transferable: ${params.transferable}`);

        // Extract segments
        const amountMatches = content.match(/amount:\s*([\d.]+(?:e\d+)?)/g);
        const exponentMatches = content.match(/exponent:\s*ud2x18\(([\d.]+(?:e\d+)?)\)/g);
        const milestoneMatches = content.match(/milestone:\s*(\d+)/g);

        if (amountMatches && exponentMatches && milestoneMatches) {
            const segments = [];
            for (let i = 0; i < amountMatches.length; i++) {
                const amount = parseFloat(amountMatches[i].match(/[\d.]+(?:e\d+)?/)[0]);
                const exponent = parseFloat(exponentMatches[i].match(/[\d.]+(?:e\d+)?/)[0]);
                const milestone = parseInt(milestoneMatches[i].match(/\d+/)[0]);
                segments.push(new LockupDynamicSegment(amount, exponent, milestone));
                console.log(`Found segment ${i}: amount=${amount}, exponent=${exponent}, milestone=${milestone}`);
            }
            params.segments = segments;
        } else {
            throw new Error("Could not match the segments in the Solidity file.");
        }

    } catch (e) {
        console.error(`Error parsing file ${filePath}: ${e}`);
        throw e;
    }

    return params;
}

// Function to create batch of CreateWithMilestones objects
function createBatchFromFiles(files) {
    const batch = [];
    for (const filePath of files) {
        try {
            const params = parseSolidityFile(filePath);
            batch.push(new LockupDynamicCreateWithMilestones(
                params.sender,
                params.startTime,
                params.cancelable,
                params.transferable,
                params.recipient,
                params.totalAmount,
                params.asset,
                null,  // Add broker extraction if needed
                params.segments
            ));
        } catch (e) {
            console.error(`Skipping file ${filePath} due to error: ${e}`);
        }
    }
    return batch;
}

// Directory containing Solidity files
const solidityFilesDirectory = 'contracts/time_lock/';

// Get list of all Solidity files in the directory
const solidityFiles = fs.readdirSync(solidityFilesDirectory).filter(f => f.endsWith('.sol')).map(f => path.join(solidityFilesDirectory, f));

// Create batch from Solidity files
const batch = createBatchFromFiles(solidityFiles);

// Example of how to pass the batch to the createWithMilestones function
for (const b of batch) {
    console.log(`Sender: ${b.sender}, Recipient: ${b.recipient}, StartTime: ${b.startTime}, TotalAmount: ${b.totalAmount}, Asset: ${b.asset}, Cancelable: ${b.cancelable}, Transferable: ${b.transferable}`);
    for (let i = 0; i < b.segments.length; i++) {
        const segment = b.segments[i];
        console.log(`  Segment ${i}: Amount: ${segment.amount}, Exponent: ${segment.exponent}, Milestone: ${segment.milestone}`);
    }
}

// Connect to the Base blockchain using QuickNode
const provider = new ethers.providers.JsonRpcProvider('https://wild-nameless-sheet.base-sepolia.quiknode.pro/6fbb48054c8a584d38a44ffbcef70f6e78ccd53d/');

// Load contract ABI from a file
const contractAbi = JSON.parse(fs.readFileSync('abi.json', 'utf8'));

// Instantiate the contract
const contract = new ethers.Contract(contractAddress, contractAbi, provider);

// Verify if the function exists
if (contract.functions.createWithMilestones) {
    console.log("The function createWithMilestones exists in the contract.");
} else {
    console.log("The function createWithMilestones does not exist in the contract.");
    process.exit(1);
}

// Function to call createWithMilestones
async function callCreateWithMilestones(batch, contract) {
    const wallet = new ethers.Wallet(privateKey, provider);

    // Prepare batch data
    const batchData = batch.map(item => ({
        sender: ethers.utils.getAddress(item.sender),
        startTime: item.startTime,
        cancelable: item.cancelable,
        transferable: item.transferable,
        recipient: ethers.utils.getAddress(item.recipient),
        totalAmount: item.totalAmount,
        asset: ethers.utils.getAddress(item.asset),
        broker: item.broker,
        segments: item.segments.map(segment => ({
            amount: segment.amount,
            exponent: segment.exponent,
            milestone: segment.milestone
        })),
        broker: {
            account: ethers.utils.getAddress(account), // Ensure this is set correctly
            fee: ethers.utils.parseUnits('0', 'ether')
        }
    }));

    // Build the transaction
    const nonce = await wallet.getTransactionCount();
    const txn = await contract.populateTransaction.createWithMilestones(
        ethers.utils.getAddress('0x94E596EEd73b4e3171c067f05A87AB0268cA993c'), // lockupDynamic address
        ethers.utils.getAddress(batch[0].asset), // Assuming all assets are the same
        batchData,
        {
            gasLimit: 2000000,
            gasPrice: ethers.utils.parseUnits('50', 'gwei'),
            nonce: nonce
        }
    );

    // Explicitly set the chainId in the transaction object
    txn.chainId = 84532;

    // Sign the transaction
    const signedTxn = await wallet.signTransaction(txn);

    // Send the transaction
    const tx = await provider.sendTransaction(signedTxn);

    // Wait for the transaction receipt
    const receipt = await tx.wait();
    return receipt;
}

callCreateWithMilestones(batch, contract).then(receipt => {
    console.log(`Transaction receipt: ${JSON.stringify(receipt)}`);
}).catch(error => {
    console.error(`Error calling createWithMilestones: ${error}`);
});
