/*
var http = require("http");

var server = http.createServer(function(req,res){
    console.log("client request !!!");
});

server.listen(3000, function(){ // VM은 3000번이 열려 있음  // 함수 작성
    console.log("Start WebServer !!!");
}); 
*/

/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

//'use strict';  // 안전성을 위해 작성


// 외부모듈 포함
const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');
//const { FileSystemWallet, Gateway, Wallets } = require('fabric-network');

var express = require("express"); // 추가설치 필요
const path = require("path");
const fs = require('fs');
//var bodyParser = require("body-parser");

const app = express(); // 관례적으로 app으로 사용

// load the network configuration

// 서버설정
const PORT = 3000;
const HOST = "0.0.0.0" // 모든 IP 주소 다 받겠다.
app.use(express.static(path.join(__dirname, "views")));
//app.use(bodyParser.json());
app.use(express.json());
//app.use(bodyParser.urlencoded({extendted:false}));
app.use(express.urlencoded({ extended: false }));

// fabric 연결설정
//const ccpPath = path.resolve(__dirname, '..', '..', '..', 'fabric-samples','test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
//const ccpPath = path.resolve(__dirname, '..', 'ulsan-network','organizations','peerOrganizations','org1.example.com', 'connection-org1.json');
const ccpPath = path.resolve(__dirname, 'connection-org1.json');

//const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
//const ccp = JSON.parse(ccpJSON);
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

// index.html 페이지 라우팅
app.get("/", (req,res) => {
    console.log(`In "/"`);
    //res.writeHead('200', {'Content-Type':'text/html;charset=utf8'})
    //res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
    //res.end()
    res.sendFile(__dirname+"/views/index.html"); // server.js가 실행된 주소  

});

// /admin POST
app.post("/admin", async(req,res)=>{ //async 추가해주어야 await 빨간 줄이 사라짐 동기 비동기
    // client로 부터 params받아오기
    const adminid = req.body.id
    const adminpw = req.body.password

    console.log(adminid + ":" + adminpw)

    try {
        // Create a new CA client for interacting with the CA.
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user.
        const identity = await wallet.get(adminid);
        if (identity) {
            console.log(`An identity for the admin user "${adminid}" already exists in the wallet`);

            const str = `An identity for the admin user "${adminid}" already exists in the wallet`
            const jsonmsg = {result:"failed", msg:str}

            res.status(200).json(jsonmsg)
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({ enrollmentID: adminid, enrollmentSecret: adminpw });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put(adminid, x509Identity);
        console.log(`Successfully enrolled admin user "${adminid}" and imported it into the wallet`);

        const str = `Successfully enrolled admin user "${adminid}" and imported it into the wallet`
        const jsonmsg = {result:"success", msg:str}

        res.status(200).json(jsonmsg)

    } catch (error) {
        console.error(`Failed to enroll admin user "${adminid}": ${error}`);
        //process.exit(1);  // server 종료!
        const str = `Failed to enroll admin user "${adminid}": ${error}`
        const jsonmsg = {result:"failed", msg:str}

        res.json(jsonmsg)
    }
})

// /user POST
app.post("/user", async(req,res)=>{
    const id = req.body.id
    const role = req.body.role
    
    //console.json(jsonmsg)
    console.log(id + ":" + role)

    try {
        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(id);
        if (userIdentity) {
            console.log(`An identity for the user "${id}" already exists in the wallet`);
            const str = `An identity for the user "${id}" already exists in the wallet`;
            const jsonmsg = {result:"failed", msg:str};

            res.status(200).json(jsonmsg);
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            //console.log('Run the enrollAdmin.js application before retrying');
            const str = 'An identity for the admin user "admin" does not exist in the wallet';
            const jsonmsg = {result:"failed", msg:str};

            res.status(200).json(jsonmsg);
            return;
        }

        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: id,
            role: role
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: id,
            enrollmentSecret: secret
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put(id, x509Identity);
        console.log(`Successfully registered and enrolled admin user "${id}" and imported it into the wallet`);
        const str = `Successfully registered and enrolled admin user "${id}" and imported it into the wallet`;
        const jsonmsg = {result:"success", msg:str}

        res.status(200).json(jsonmsg);

    } catch (error) {
        console.error(`Failed to register user "${id}": ${error}`);
        //process.exit(1);  // server 종료!
        const str = `Failed to register user "${id}": ${error}`
        const jsonmsg = {result:"failed", msg:str}
        
        res.json(jsonmsg)
    }
    
})

// health 등록(<-자산생성)
app.post("/health", async(req,res)=>{
    //{number, name, dateofbirth, kcd, doctor, dateofdaignosis}
    const cert = req.body.cert  // 인증서이름
    
    const id = req.body.id // 환자번호(number)
    const color = req.body.color // 환자성명(name)
    const size = req.body.size  // 생년월일(dateofbirth)
    const kcd = req.body.kcd // 질병분류기호(kcd)
    const owner = req.body.owner  // 담당의료진(doctor)
    const value = req.body.appraisedValue // 진료일자(dateofdaignosis)

    console.log("/health-post: " + cert + "; " + id + "; " + color + "; " + size + "; " + kcd + "; "  + owner + "; " + value + ".")

    
    try {
        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(cert);
        if (!userIdentity) {
            console.log(`An identity for the user "${cert}" not exists in the wallet`);
            // const str = `An identity for the user "${cert}" already exists in the wallet`;
            // const jsonmsg = {result:"failed", msg:str};

            //res.status(200).json(jsonmsg);
            res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            res.end();
            return;
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: cert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("healthchannel");

        // Get the contract
        const contract = network.getContract("health");

        // Health_register (<- CreateAsset) CC 함수 호출
        await contract.submitTransaction('Health_register', id, color, size, kcd, owner, value); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();

        const resultPath = path.join(process.cwd(), "views/result.html")
        var resultHTML = fs.readFileSync(resultPath, "utf-8")
        var str = `<p> Transaction (CreateAsset: ${id}) has been submitted!</p><br>`
        resultHTML = resultHTML.replace("<dir></dir>", str)
        res.status(200).send(resultHTML)


    } catch (error) {
        console.error(`Failed to create asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
        res.write(`Failed to register user "${id}": ${error}`)
        res.end();

    }
})

// health 조회(<-자산조회)
app.get("/health", async(req,res)=>{
    const cert = req.query.cert // get메소드를 쓰기 때문에 body 아니고 query
    const id = req.query.id  // 환자번호
    console.log(cert, id)

    try {        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(cert);
        if (!userIdentity) {
            console.log(`An identity for the user "${cert}" not exists in the wallet`);
            const str = `An identity for the user "${cert}" already exists in the wallet`;
            const jsonmsg = {result:"failed", msg:str};

            res.status(200).json(jsonmsg);
            //res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            //res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            //res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            //res.end();
            return;           
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: cert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("healthchannel");

        // Get the contract
        const contract = network.getContract("health");

        // ReadAsset CC 함수 호출
        result = await contract.evaluateTransaction('Health_query', id); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();

        //const jsonmsg = {result:"success", msg:str};
        const jsonmsg = `{"result":"success", "msg":${result}}`

        //res.status(200).json(jsonmsg);
        res.status(200).json(JSON.parse(jsonmsg));

    } catch (error) {
        console.error(`Failed to read asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!

        const str = `Failed to read asset "${id}": ${error}`
        const jsonmsg = {result:"failed", msg:str};

        res.status(200).json(jsonmsg);
    }
})

// 자산생성
app.post("/asset", async(req,res)=>{
    const cert = req.body.cert
    const id = req.body.id
    const color = req.body.color
    const size = req.body.size
    const owner = req.body.owner
    const value = req.body.appraisedValue

    console.log("/asset-post: " + cert + "; " + id + "; " + color + "; " + size + "; " + owner + "; " + value + ".")

    
    try {
        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(cert);
        if (!userIdentity) {
            console.log(`An identity for the user "${cert}" not exists in the wallet`);
            // const str = `An identity for the user "${cert}" already exists in the wallet`;
            // const jsonmsg = {result:"failed", msg:str};

            //res.status(200).json(jsonmsg);
            res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            res.end();
            return;
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: cert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("mychannel");

        // Get the contract
        const contract = network.getContract("basic");

        // CreateAsset CC 함수 호출
        await contract.submitTransaction('CreateAsset', id, color, size, owner, value); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();

        const resultPath = path.join(process.cwd(), "views/result.html")
        var resultHTML = fs.readFileSync(resultPath, "utf-8")
        var str = `<p> Transaction (CreateAsset: ${id}) has been submitted!</p><br>`
        resultHTML = resultHTML.replace("<dir></dir>", str)
        res.status(200).send(resultHTML)


    } catch (error) {
        console.error(`Failed to create asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
        res.write(`Failed to register user "${id}": ${error}`)
        res.end();

    }
})

// 자산조회
app.get("/asset", async(req,res)=>{
    const cert = req.query.cert // get메소드를 쓰기 때문에 body 아니고 query
    const id = req.query.id
    console.log(cert, id)

    try {        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(cert);
        if (!userIdentity) {
            console.log(`An identity for the user "${cert}" not exists in the wallet`);
            const str = `An identity for the user "${cert}" already exists in the wallet`;
            const jsonmsg = {result:"failed", msg:str};

            res.status(200).json(jsonmsg);
            //res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            //res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            //res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            //res.end();
            return;           
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: cert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("mychannel");

        // Get the contract
        const contract = network.getContract("basic");

        // ReadAsset CC 함수 호출
        result = await contract.evaluateTransaction('ReadAsset', id); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();

        //const jsonmsg = {result:"success", msg:str};
        const jsonmsg = `{"result":"success", "msg":${result}}`

        //res.status(200).json(jsonmsg);
        res.status(200).json(JSON.parse(jsonmsg));

    } catch (error) {
        console.error(`Failed to read asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!

        const str = `Failed to read asset "${id}": ${error}`
        const jsonmsg = {result:"failed", msg:str};

        res.status(200).json(jsonmsg);
    }
})

// 자산변경
app.post("/update", async(req,res)=>{
    const cert = req.body.cert
    const id = req.body.id
    const color = req.body.color
    const size = req.body.size
    const owner = req.body.owner
    const value = req.body.appraisedValue

    console.log("/asset-post: " + cert + "; " + id + "; " + color + "; " + size + "; " + owner + "; " + value + ".")

    try {
        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(cert);
        if (!userIdentity) {
            console.log(`An identity for the user "${cert}" not exists in the wallet`);
            // const str = `An identity for the user "${cert}" already exists in the wallet`;
            // const jsonmsg = {result:"failed", msg:str};

            //res.status(200).json(jsonmsg);
            res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            res.end();
            return;
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: cert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("mychannel");

        // Get the contract
        const contract = network.getContract("basic");

        // CreateAsset CC 함수 호출
        await contract.submitTransaction('UpdateAsset', id, color, size, owner, value); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();

        const resultPath = path.join(process.cwd(), "views/result.html")
        var resultHTML = fs.readFileSync(resultPath, "utf-8")
        var str = `<p> Transaction (UpdateAsset: ${id}) has been submitted!</p><br>`
        resultHTML = resultHTML.replace("<dir></dir>", str)
        res.status(200).send(resultHTML)


    } catch (error) {
        console.error(`Failed to create asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
        res.write(`Failed to Update user "${id}": ${error}`)
        res.end();

    }

})

// 자산삭제
app.post("/delete", async(req, res)=>{
    const cert = req.body.cert
    const id = req.body.id
    console.log(cert, id)

    try {        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(cert);
        if (!userIdentity) {
            console.log(`An identity for the user "${cert}" not exists in the wallet`);
            str = `An identity for the user "${cert}" not exists in the wallet`
            const jsonmsg = {rcode:"F001", msg:str};

            res.status(200).json(jsonmsg);
            //res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            //res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            //res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            //res.end();
            return;           
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: cert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("mychannel");

        // Get the contract
        const contract = network.getContract("basic");

        // DeleteAsset CC 함수 호출
        await contract.submitTransaction('DeleteAsset', id); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();

        //const jsonmsg = {result:"success", msg:str};
        //const jsonmsg = `{"result":"success", "msg":${result}}`
        var str = `success the job`
        const jsonmsg = {rcode:"S001", msg:str};

        //res.status(200).json(jsonmsg);
        res.status(200).json(jsonmsg);

    } catch (error) {
        console.error(`Failed to delete asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!

        const str = `Failed to delete asset "${id}": ${error}`
        const jsonmsg = {result:"F00x", msg:str};

        res.status(200).json(jsonmsg);
    }

})

// 거래하기
app.post("/transfer", async(req,res)=>{
    const scert = req.body.scert
    const bcert = req.body.bcert
    const id = req.body.id
    console.log(scert, bcert, id)
    
    try {        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const suserIdentity = await wallet.get(scert);
        if (!suserIdentity) {
            console.log(`An identity for the user "${scert}" not exists in the wallet`);
            str = `An identity for the user "${scert}" not exists in the wallet`
            const jsonmsg = {rcode:"F002", msg:str};

            res.status(200).json(jsonmsg);
            //res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            //res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            //res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            //res.end();
            return;           
        }

        const buserIdentity = await wallet.get(bcert);
        if (!buserIdentity) {
            console.log(`An identity for the user "${bcert}" not exists in the wallet`);
            str = `An identity for the user "${bcert}" not exists in the wallet`
            const jsonmsg = {rcode:"F003", msg:str};

            res.status(200).json(jsonmsg);
            //res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            //res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            //res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            //res.end();
            return;           
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: scert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("mychannel");

        // Get the contract
        const contract = network.getContract("basic");

        // DeleteAsset CC 함수 호출
        result = await contract.evaluateTransaction('ReadAsset', id); // 에러는 catch문으로 날라간다.

        const obj = JSON.parse(result.toString())
        console.log(obj.owner)
        if(obj.owner != scert){
            console.log(`An identity for the user "${scert}" not equals the owner`);
            str = `An identity for the user "${scert}" not equals the owner`
            const jsonmsg = {rcode:"F004", msg:str};

            res.status(200).json(jsonmsg);
            return;        
        }

        // DeleteAsset CC 함수 호출
        await contract.submitTransaction('TransferAsset', id, bcert); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();
                
        //const jsonmsg = `{"result":"success", "msg":${result}}`
        var str = `success the job`
        const jsonmsg = {rcode:"S001", msg:str};
        
        res.status(200).json(jsonmsg);       

        //const jsonmsg = {result:"success", msg:str};
        //const jsonmsg = `{"result":"success", "msg":${result}}`
        //var str = `success the job`
        //const jsonmsg = {rcode:"S001", msg:str};

        //res.status(200).json(jsonmsg);
        //res.status(200).json(jsonmsg);

    } catch (error) {
        console.error(`Failed to transfer asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!

        const str = `Failed to transfer asset "${id}": ${error}`
        const jsonmsg = {result:"F00x", msg:str};

        res.status(200).json(jsonmsg);
    }

})


app.get("/assets", async(req,res)=>{
    const cert = req.query.cert // get메소드를 쓰기 때문에 body 아니고 query
    const id = req.query.id
    console.log(cert, id)

    try {        
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get(cert);
        if (!userIdentity) {
            console.log(`An identity for the user "${cert}" not exists in the wallet`);
            const str = `An identity for the user "${cert}" already exists in the wallet`;
            const jsonmsg = {result:"failed", msg:str};

            res.status(200).json(jsonmsg);
            //res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
            //res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
            //res.write(`<p>An identity for the user "${cert}" not exists in the wallet</p>`);
            //res.end();
            return;           
        }

        // from app.js
        // a user that has been verified.
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: cert,
            discovery: { enabled: true, asLocalhost: true}
        });

        // Build a network instance
        const network = await gateway.getNetwork("mychannel");

        // Get the contract
        const contract = network.getContract("basic");

        // ReadAsset CC 함수 호출
        result = await contract.evaluateTransaction('GetAllAssets'); // 에러는 catch문으로 날라간다.
        await gateway.disconnect();

        //const jsonmsg = {result:"success", msg:str};
        const jsonmsg = `{"result":"success", "msg":${result}}`

        //res.status(200).json(jsonmsg);
        res.status(200).json(JSON.parse(jsonmsg));

    } catch (error) {
        console.error(`Failed to read asset "${id}": ${error}`);
        //process.exit(1);  // server 종료!

        const str = `Failed to read asset "${id}": ${error}`
        const jsonmsg = {result:"failed", msg:str};

        res.status(200).json(jsonmsg);
    }
})

// 서버시작
app.listen(PORT, HOST); // 포트번호, host ip address
console.log(`Running on http://://${HOST}:${PORT}`)
//console.log("Running on http://://"+HOST+":"+PORT)