require('dotenv').config();
const express = require('express');
const TronWeb = require('tronweb');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const MAIN = 'THPwhGhhmZo1hrwSNsSCcUz9X1R2eDd6as';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '27876041';
const USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

let tronWeb;
try {
  tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: process.env.MAIN_PRIVATE_KEY
  });
} catch(e) { console.log("Set MAIN_PRIVATE_KEY in.env on server"); }

let ledger = {};
const getBal = (a) => ledger[a] || 0;

function checkAdmin(req,res,next){
    const pass = req.headers['x-admin-password'] || req.body.adminPassword;
    if(pass!== ADMIN_PASSWORD){
        return res.status(401).json({error:'UNAUTHORIZED: Wrong password'});
    }
    next();
}

app.post('/api/deposit', (req,res)=>{
    const {senderAddress, amount} = req.body;
    if(!senderAddress ||!amount) return res.json({error:'Missing fields'});
    ledger[senderAddress] = getBal(senderAddress) + parseFloat(amount);
    res.json({success:true, message:`Credited ${amount} USDT to ${senderAddress} INSIDE Main ${MAIN}`, ledger, main: MAIN});
});

app.post('/api/internal-transfer', (req,res)=>{
    const {senderInput, receiverInput, amount} = req.body;
    const amt = parseFloat(amount);
    if(getBal(senderInput) < amt) return res.json({error:`Sender only has ${getBal(senderInput)} USDT inside Main`, ledger});
    ledger[senderInput] -= amt;
    ledger[receiverInput] = getBal(receiverInput) + amt;
    res.json({success:true, type:"INTERNAL-0-FEE-INSTANT-SUCCESS", message:`SUCCESS: Moved ${amt} USDT from ${senderInput} to ${receiverInput} WITHIN Main ${MAIN}`, ledger});
});

app.get('/api/balance/:address', (req,res)=>{
    res.json({address:req.params.address, internalBalance:getBal(req.params.address), mainVault: MAIN});
});

app.post('/api/withdraw', checkAdmin, async (req,res)=>{
    try{
        const {receiverInput, amount} = req.body;
        if(!tronWeb) return res.json({error:'Server missing MAIN_PRIVATE_KEY'});
        const contract = await tronWeb.contract().at(USDT);
        const tx = await contract.transfer(receiverInput, Math.floor(parseFloat(amount)*1e6)).send({feeLimit:100000000});
        res.json({success:true, message:`Withdrew ${amount} from Main ${MAIN} to ${receiverInput}`, txid:tx, link:`https://tronscan.org/#/transaction/${tx}`});
    }catch(e){ res.json({error:e.message}); }
});

app.get('/', (req,res)=> res.sendFile(__dirname + '/public/index.html'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`SECURE Main ${MAIN} running - Admin Pass: 27876041 - Port ${PORT}`));
